/*
 * Copyright (C) 2015 con terra GmbH (info@conterra.de)
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *         http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
define([
    "dojo/_base/array",
    "dojo/_base/lang",
    "dojo/promise/all",
    "dojo/io-query",
    "ct/_when",
    "ct/mapping/geometry",
    "apprt-request",
    "./ctArrayExtension"
], function (d_array, d_lang, all, d_ioq, ct_when, geometry, apprt_request, ctArrayExtension) {
    var queryItemCount = {};

    queryItemCount.setWMSLayerItemCountInVisibleExtent = function (layers) {
        layers = !layers || d_lang.isArray(layers) ? layers : [layers];
        d_array.forEach(layers, function (layer) {
            var itemCounts = layer.itemCounts = [];
            layer.visibleExtent && d_array.forEach(layer.layerInfos, function (layerInfo) {
                itemCounts.push(layerInfo.visibleExtent ? 1 : 0);
            });
        });

        return true;
    };

    queryItemCount.queryRendererInfos = function (layers) {
        var requests = [];
        layers = !layers || d_lang.isArray(layers) ? layers : [layers];
        d_array.forEach(layers, function (layer) {
            var serverUrl = layer.url;
            var layerInfos = layer.layerInfos;

            d_array.forEach(layer.visibleLayers, function (visibleLayer) {
                var layerInfo = ctArrayExtension.arrayStringSearchFirst(layerInfos, "id", visibleLayer);
                var request = layerInfo && queryItemCount._executeGetRendererInfosRequest(serverUrl, layerInfo);
                request && requests.push(request);
            }, this);
        });

        return requests.length ? new all(requests) : null;
    };

    queryItemCount.queryItemCountInVisibleExtent = function (layers) {
        var requests = [];
        layers = !layers || d_lang.isArray(layers) ? layers : [layers];
        d_array.forEach(layers, function (layer) {
            var serverUrl = layer.url;
            var layerInfos = layer.layerInfos;
            var itemCounts = layer.itemCounts = [];
            var visibleExtent = layer.visibleExtent;
            if (visibleExtent) {
                var version = layer.version;
                d_array.forEach(layer.visibleLayers, function (visibleLayer) {
                    var layerInfo = ctArrayExtension.arrayStringSearchFirst(layerInfos, "id", visibleLayer);
                    var request = layerInfo && queryItemCount._executeItemCountRequest(serverUrl, layerInfo, visibleExtent, itemCounts, version);
                    request && requests.push(request);
                }, this);
            }
        });

        return requests.length ? new all(requests) : null;
    };

    queryItemCount._executeItemCountRequest = function (mapServerUrl, layerInfo, extent, itemCounts, version) {
        var dynamicLegendInfo = layerInfo.dynamicLegendInfo;
        if (!dynamicLegendInfo) {
            dynamicLegendInfo = layerInfo.dynamicLegendInfo = {};
        }

        var fields = dynamicLegendInfo.hasServerLegendItemAtCurrentScale ? dynamicLegendInfo.renderer.fields : null;
        var lastExtent = dynamicLegendInfo.extent;
        var lastItemCount = dynamicLegendInfo.itemCount || 0;
        if (layerInfo.noDynamicLegend) {
            return queryItemCount._setDynamicLegendInfo({count: -1}, extent, fields, dynamicLegendInfo, itemCounts);
        }
        else if (lastExtent && (geometry.equal(extent, lastExtent) || ((!fields || fields.length < 1) && lastItemCount > 0 && extent.contains(lastExtent)))) {
            itemCounts && itemCounts.push(lastItemCount);
            return null;
        }
        else {
            var requestUrl = queryItemCount._getItemCountRequestUrl(mapServerUrl, layerInfo.id, extent, fields, version);
            var request = apprt_request(requestUrl, {method: "GET"});
            return ct_when(request, function (result) {
                return queryItemCount._setDynamicLegendInfo(result, extent, fields, dynamicLegendInfo, itemCounts);
            }, function (error) {
                return queryItemCount._setDynamicLegendInfo({count: -1, error: error}, extent, fields, dynamicLegendInfo, itemCounts);
            }, this);
        }
    };

    queryItemCount._executeGetRendererInfosRequest = function (mapServerUrl, layerInfo) {
        var dynamicLegendInfo = layerInfo.dynamicLegendInfo;
        if (!dynamicLegendInfo) {
            dynamicLegendInfo = layerInfo.dynamicLegendInfo = {};
        }
        else if (dynamicLegendInfo.renderer != undefined) {
            return null;
        }

        var requestUrl = queryItemCount._getRedererRequestUrl(mapServerUrl, layerInfo.id);
        var request = apprt_request(requestUrl, {method: "GET"});
        return ct_when(request, function (result) {
            dynamicLegendInfo.renderer = {
                type: null,
                fields: []
            };

            var renderer = result && result.drawingInfo && result.drawingInfo.renderer;
            if (renderer) {
                var dRenderer = dynamicLegendInfo.renderer;
                var type = dRenderer.type = renderer.type;
                var fields = dRenderer.fields;
                if (type == "classBreaks") {
                    renderer.field && fields.push(renderer.field);
                    var classMaxValues = [];
                    d_array.forEach(renderer.classBreakInfos, function (classBreakInfo) {
                        classMaxValues.push(classBreakInfo.classMaxValue);
                    });
                    dRenderer.classMaxValues = classMaxValues.sort(function (value1, value2) {
                        return value1 - value2;
                    });
                }
                else if (type == "uniqueValue") {
                    renderer.field1 && fields.push(renderer.field1);
                    renderer.field2 && fields.push(renderer.field2);
                    renderer.field3 && fields.push(renderer.field3);
                }
            }
            return true;
        }, function (error) {
            queryItemCount._setError(error);
        }, this);
    };

    queryItemCount._setDynamicLegendInfo = function (result, extent, fields, dynamicLegendInfo, itemCounts) {
        var features = result && result.features;
        var objectIds = result && result.objectIds;
        var count = result && result.count || objectIds && objectIds.length || features && features.length || 0;
        var error = result.error;
        if (error) {
            count = -1;
            queryItemCount._setError(error);
        }

        itemCounts && itemCounts.push(count);

        dynamicLegendInfo.extent = extent;
        dynamicLegendInfo.itemCount = count;
        dynamicLegendInfo.values = null;
        if (fields && fields.length) {
            var values = dynamicLegendInfo.values = [];
            d_array.forEach(fields, function (field) {
                var fieldValues = [];
                values.push(fieldValues);
                features && features.length && d_array.forEach(features, function (feature) {
                    fieldValues.push(feature.attributes[field]);
                });
            });
        }

        return {count: count};
    };

    queryItemCount._setError = function (error) {
        if (error) {
            error.message = "no legend! " + (error.message || "");
            console.error(error);
        }
    };

    queryItemCount._getRedererRequestUrl = function (mapServerUrl, layerId) {
        return queryItemCount._getRequestUrl(mapServerUrl, layerId, "", {f: "json"});
    };

    queryItemCount._getItemCountRequestUrl = function (mapServerUrl, layerId, extent, fileds, version) {
        var params = {
            f: "json",
            returnGeometry: false,
            inSR: extent.spatialReference.wkid,
            spatialRel: "esriSpatialRelIntersects",
            geometryType: "esriGeometryEnvelope",
            geometry: "" + extent.xmin + "," + extent.ymin + "," + extent.xmax + "," + extent.ymax
        };

        if (fileds && fileds.length) {
            params.returnDistinctValues = true;
            params.outFields = fileds.join();
        }
        else if (!version || version < 10.3) {
            params.returnCountOnly = true;
        }
        else {
            params.returnIdsOnly = true;
            params.resultRecordCount = 1;
        }

        return queryItemCount._getRequestUrl(mapServerUrl, layerId, "/query", params);
    };

    queryItemCount._getRequestUrl = function (mapServerUrl, layerId, path, params) {
        var uriS = mapServerUrl.split("?");

        params = d_lang.mixin(uriS.length > 1 && d_ioq.queryToObject(uriS[1]) || {}, params);
        return uriS[0] + "/" + layerId + path + "?" + d_ioq.objectToQuery(params);
    };
    return queryItemCount;
});