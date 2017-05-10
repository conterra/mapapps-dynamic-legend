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
    "dojo/_base/declare",
    "dojo/_base/Deferred",
    "dojo/_base/array",
    "dojo/_base/lang",
    "dojo/dom-construct",
    "ct/_lang",
    "ct/_when",
    "ct/util/css",
    "./ctArrayExtension",
    "./QueryItemCount",
    "./EsriLegendExtension"
], function (declare, Deferred, d_array, d_lang, d_domconstruct, ct_lang, ct_when, ct_css, ctArrayExtension, QueryItemCount, EsriLegendExtension) {
    var org_createLegend = EsriLegendExtension.prototype._createLegend;
    return declare([EsriLegendExtension], {
        // expected to be provided
        mapState: null,
        mapModel: null,
        legendToggleTool: null,
        showDynamicLegend: false,
        coordinateTransformer: null,

        //local
        _refreshTimer: null,
        _showProcessingTimer: null,
        _queryItemCountDeferred: null,

        postCreate: function () {
            this.inherited(arguments);
            this.connect(this.mapModel, "onModelNodeStateChanged", "_refreshOnNodeStateChange");
            this.connect(this.mapState, "onExtentChange", "_refreshOnExtentChange");
            this.connect(this.mapState, "onZoomEnd", "_refreshOnZoomEnd");
        },

        _isStarted: function () {
            return this._started;
        },

        _isVisible: function () {
            var legendToggleTool = this.legendToggleTool;
            return !legendToggleTool || legendToggleTool.get("active");
        },

        _isDynamicLegend: function () {
            return this.showDynamicLegend;
        },

        _isExcludeLayer: function (layerInfo) {
            return layerInfo.excludeLayer;
        },

        _setShowDynamicLegend: function (showDynamicLegend) {
            this.showDynamicLegend = showDynamicLegend;
            this._refresh();
        },

        _refreshOnNodeStateChange: function () {
            this._refresh();
        },

        _refreshOnExtentChange: function () {
            this._isDynamicLegend() && this._refresh();
        },

        _refreshOnZoomEnd: function () {
            !this._isDynamicLegend() && this._refresh();
        },

        _refresh: function () {
            this._isStarted() && this._isVisible() && this.refresh();
        },

        /*
         * Patch original method to dynamic legend display
         */
        _createLegend: function () {
            var that = this;
            clearTimeout(this._refreshTimer);
            this._refreshTimer = setTimeout(function () {
                //set WMS sublayer infos
                var originalLayerInfos = that._replaceWMSLayerInfos();

                //add config data(staticLegend and dynamicLegend) to layer infos
                that._addConfigData();

                //create legend
                that._isDynamicLegend() ? that._createDynamicLegend() : that._esriCreateLegendPatch();

                //revert WMS sublayer infos
                that._revertWMSLayerInfos(originalLayerInfos);
            }, 500);
        },

        _createDynamicLegend: function () {
            var layers = this.layers;
            if (!layers || !layers.length) {
                return this._esriCreateLegendPatch();
            }

            //show processing pane
            this._showProcessing(true);

            //clear ItemCountDeferred
            var queryItemCountDeferred = this._queryItemCountDeferred;
            queryItemCountDeferred && !queryItemCountDeferred.isFulfilled() && queryItemCountDeferred.cancel(false);

            //set dynamicLegend attr at current extent
            this._setVisibleExtent(layers);
            this._setHasDynamicLegendItemAtCurrentScale(layers);

            //WMS Server Layers
            var wmsLayers = this._getWMSLayers(layers);
            wmsLayers.length && QueryItemCount.setWMSLayerItemCountInVisibleExtent(wmsLayers);

            //ArcGIS Server Layers
            var arcGISLayers = this._getArcGISLayers(layers);
            if (arcGISLayers.length) {
                var queryRendererInfos = QueryItemCount.queryRendererInfos(arcGISLayers);
                var that = this;
                ct_when(queryRendererInfos, function () {
                    queryItemCountDeferred = that._queryItemCountDeferred = QueryItemCount.queryItemCountInVisibleExtent(arcGISLayers, that.mapState.getExtent());
                    ct_when(queryItemCountDeferred, function () {
                        //hide processing pane
                        that._showProcessing(false);
                        that._esriCreateLegendPatch();
                    });
                });
            }
            else {
                //hide processing pane
                this._showProcessing(false);
                this._esriCreateLegendPatch();
            }
        },

        /*
         * Patch original method to display 1. config legend item, 2. WMS sublayer infos
         * WMS sublayers are not displayed in legend. This function (temporarily!)
         * replaces all layerinfos with sublayers by their sublayer layerinfos.
         *
         * This function also respects the hideLayers properties on WMSLayers (if set).
         */
        _esriCreateLegendPatch: function () {
            //apply esri legend
            org_createLegend.apply(this, arguments);
        },

        /**
         * Patch original method, to ensure that it allways returns a deferred.
         */
        _legendRequest: function (layer) {
            var d = this.inherited(arguments);
            if (!d) {
                d = new Deferred();
                d.resolve(true);
            }
            return d;
        },

        /**
         * This patches the orginial method and extend it to support the showBaseLayer flag.
         */
        _isSupportedLayerType: function (layer) {
            return this.inherited(arguments) && this._showLayerInLegend(layer);
        },

        _showLayerInLegend: function (layer) {
            var opacity = layer.opacity;
            if (!opacity) {
                return false;
            } else {
                var node = this.mapModel.getNodeById(layer.__managed);
                var showInLegend = node && node.get("showInLegend");
                var excludeLayers = node && node.get("excludeLayers");
                var isExcludeLayer = excludeLayers && !d_array.some(layer.visibleLayers, function (visibleLayer) {
                        return excludeLayers.indexOf(visibleLayer) == -1;
                    });
                return !isExcludeLayer && (showInLegend || showInLegend === undefined) && (this.showBaseLayer || (!this._isBaseLayer(layer) && !node.get("isBaseLayerReference")));
            }
        },

        _isBaseLayer: function (layer) {
            var mapModel = this.mapModel;
            var layerId = layer.__managed;
            // Note: here we access the __managed flag of the esriLayer, which is added by the EsriLayerManager Property
            // it contains the id of the model node
            return mapModel.getServiceNodes(mapModel.getBaseLayer(), function (baseLayerNode) {
                    return (layerId && baseLayerNode.get("id") === layerId);
                }, this).length > 0;
        },
        _hasItemInExtent: function (layer) {
            var itemCounts = layer.itemCounts;
            return layer.visibleExtent && (itemCounts === undefined || d_array.some(itemCounts, function (count) {
                    return !!count;
                }));
        },
        _hasDynamicLegend: function (layerInfo) {
            var dynamicLegendInfo = layerInfo.dynamicLegendInfo;
            return !layerInfo.noDynamicLegend && dynamicLegendInfo && dynamicLegendInfo.itemCount >= 0;
        },
        _showAtItemCount: function (layerInfo) {
            var show = true;
            if (this._isDynamicLegend()) {
                var dynamicLegendInfo = layerInfo && layerInfo.dynamicLegendInfo;
                show = !dynamicLegendInfo || !!dynamicLegendInfo.itemCount;
            }
            return show;
        },
        _showDynamicLegendSymbolAtItemCount: function (layerInfo, legendResponseItem, index) {
            var dynamicLegendInfo = layerInfo.dynamicLegendInfo;
            var show = dynamicLegendInfo.hasServerLegendItemAtCurrentScale && this._hasDynamicLegend(layerInfo);
            if (show) {
                var itemValues = dynamicLegendInfo && dynamicLegendInfo.values;
                var count = itemValues && itemValues.length;
                if (count) {
                    var classMaxValues = dynamicLegendInfo.renderer.classMaxValues;
                    if (classMaxValues) {
                        var min = classMaxValues[index - 1] || Number.MIN_VALUE;
                        var max = classMaxValues[index] || Number.MAX_VALUE;
                        show = d_array.some(itemValues[0], function (value) {
                            return value >= min && value <= max;
                        });
                    }
                    else {
                        var legendValues = legendResponseItem.values;
                        if (legendValues && legendValues.length) {
                            var symbolValues = [];
                            d_array.forEach(legendValues, function (legendValue) {
                                symbolValues.push((count == 1) ? [legendValue] : legendValue.split(",", count));
                            });

                            show = d_array.every(itemValues, function (values, idx) {
                                return d_array.some(symbolValues, function (lvalues) {
                                    var lvalue = lvalues[idx];
                                    return lvalue && d_array.some(values, function (value) {
                                            return String(value) == lvalue;
                                        });
                                });
                            });
                        }
                        else {
                            show = false;
                        }
                    }
                }
            }

            return show;
        },

        _showAtScale: function (scale, minScale, maxScale) {
            return (minScale === undefined || minScale >= scale) && (maxScale === undefined || maxScale <= scale);
        },

        _getLegendItemsAtScale: function (scale, legendItems, isExternalLink) {
            var items = [];
            if (legendItems) {
                items = d_array.filter(legendItems, function (item) {
                    return (item.noDynamicLegend !== true) && (isExternalLink === undefined || isExternalLink === false && item.type != "label" && !item.url || isExternalLink && (item.type == "label" || item.url)) && this._showAtScale(scale, item.minScale, item.maxScale);
                }, this);
            }

            return items;
        },

        _isDefinedNoDynamicLegendLegendAtCurrentScale: function (layerInfo) {
            var scale = this.map.getScale();
            return d_array.some(layerInfo.dynamicLegend, function (item) {
                return (item.noDynamicLegend === true) && this._showAtScale(scale, item.minScale, item.maxScale);
            }, this);
        },

        _getLegendItemsAtCurrentScale: function (layerInfo, isExternalLink, isStaticLegend) {
            var scale = this.map.getScale();
            var legendItems = this._isDynamicLegend() && !isStaticLegend && this._hasDynamicLegend(layerInfo) ? layerInfo.dynamicLegend : layerInfo.staticLegend;
            return this._getLegendItemsAtScale(scale, legendItems, isExternalLink);
        },

        _isArcGISLayer: function (layer) {
            var declaredClass = layer.declaredClass;
            return "esri.layers.WMSLayer" != declaredClass && "esri.layers.KMLLayer" != declaredClass && "esri.layers.GeoRSSLayer" != declaredClass;
        },

        _getArcGISLayers: function (layers) {
            return d_array.filter(layers, function (layer) {
                return this._isArcGISLayer(layer);
            }, this);
        },

        _getWMSLayers: function (layers) {
            return d_array.filter(layers, function (layer) {
                return !this._isArcGISLayer(layer);
            }, this);
        },

        _setHasDynamicLegendItemAtCurrentScale: function (layers) {
            var scale = this.map.getScale();
            d_array.forEach(layers, function (layer) {
                var layerInfos = layer.layerInfos;
                d_array.forEach(layer.visibleLayers, function (visibleLayer) {
                    var layerInfo = ctArrayExtension.arrayStringSearchFirst(layerInfos, "id", visibleLayer);
                    if (layerInfo) {
                        var legendItems = layerInfo.dynamicLegend;
                        var dynamicLegendInfo = layerInfo.dynamicLegendInfo;
                        if (!dynamicLegendInfo) {
                            dynamicLegendInfo = layerInfo.dynamicLegendInfo = {};
                        }
                        var hasExternalLegendItemAtCurrentScale = this._isDefinedNoDynamicLegendLegendAtCurrentScale(layerInfo) || this._getLegendItemsAtScale(scale, legendItems, true).length > 0;
                        dynamicLegendInfo.hasServerLegendItemAtCurrentScale = !hasExternalLegendItemAtCurrentScale || this._getLegendItemsAtScale(scale, legendItems, false).length > 0;
                    }
                }, this);
            }, this);
        },

        _setVisibleExtent: function (layers) {
            var currentExtent = this.mapState.getExtent();
            var wkid = currentExtent.spatialReference.wkid;
            d_array.forEach(layers, function (layer) {
                layer.visibleExtent = this._getExtentIntersects(currentExtent, layer.extent || layer.fullExtent);
                d_array.forEach(layer.layerInfos, function (layerInfo) {
                    layerInfo.visibleExtent = this._getExtentIntersects(currentExtent, layerInfo.allExtents && layerInfo.allExtents[wkid] || layerInfo.extent);
                }, this);
            }, this);
        },
        _getExtentIntersects: function (currentExtent, extent) {
            var extentIntersects = currentExtent;
            if (extent) {
                extent = d_lang.clone(extent);

                var wkid = currentExtent.spatialReference.wkid;
                var spatialReference = extent.spatialReference;
                if (spatialReference.latestWkid) {
                    spatialReference.wkid = spatialReference.latestWkid;
                    delete spatialReference.latestWkid;
                }
                extentIntersects = currentExtent.intersects(wkid == spatialReference.wkid ? extent : this.coordinateTransformer.transform(extent, wkid));
            }
            return extentIntersects;
        },
        //create legend
        _showProcessing: function (show) {
            var domNode = this.domNode;
            d_domconstruct.empty(domNode);

            clearTimeout(this._showProcessingTimer);
            show && (this._showProcessingTimer = setTimeout(function () {
                //processing pane
                d_domconstruct.create("div", {"class": "lfuLegendProcessingPane"}, domNode);
            }, 500));
        },

        _addConfigData: function () {
            d_array.forEach(this.layers, function (layer) {
                var node = this.mapModel.getNodeById(layer.__managed);
                var children = node && node.children;
                var excludeLayers = node && node.get("excludeLayers");
                children && d_array.forEach(children, function (child) {
                    var clayer = child.layer;
                    if (clayer) {
                        d_array.forEach(layer.layerInfos, function (layerInfo) {
                            layerInfo.id === undefined && layerInfo.name && (layerInfo.id = layerInfo.name);
                        });

                        var noDynamicLegend = clayer.noDynamicLegend;
                        var dynamicLegend = clayer.dynamicLegend;
                        var staticLegend = clayer.staticLegend;
                        var excludeLayer = excludeLayers && excludeLayers.indexOf(clayer.layerId) != -1;
                        if (noDynamicLegend || dynamicLegend || staticLegend || excludeLayer) {
                            var layerInfo = ctArrayExtension.arrayStringSearchFirst(layer.layerInfos, "id", clayer.layerId);

                            layerInfo && noDynamicLegend && (layerInfo.noDynamicLegend = noDynamicLegend);
                            layerInfo && dynamicLegend && (layerInfo.dynamicLegend = d_lang.isArray(dynamicLegend) ? dynamicLegend : [dynamicLegend]);
                            layerInfo && staticLegend && (layerInfo.staticLegend = d_lang.isArray(staticLegend) ? staticLegend : [staticLegend]);
                            layerInfo && excludeLayer && (layerInfo.excludeLayer = excludeLayer);
                        }
                    }
                });
            }, this);
        },

        _replaceWMSLayerInfos: function () {
            var originalLayerInfos = {};
            d_array.forEach(this.layers, function (layer) {
                if (layer.declaredClass === "esri.layers.WMSLayer") {
                    var newLayerInfos = [];
                    d_array.forEach(layer.layerInfos, function (layerInfo) {
                        newLayerInfos = newLayerInfos.concat(this._replaceLayerInfoBySubLayerInfos(layerInfo, layer));
                    }, this);

                    originalLayerInfos[layer.id] = layer.layerInfos;

                    d_array.forEach(this.layerInfos, function (layerInfo) {
                        d_array.forEach(layerInfo.hideLayers, function (id) {
                            ctArrayExtension.arrayRemove(newLayerInfos, null, function (layerInfo) {
                                return String(layerInfo.name) === String(id);
                            });
                        });
                    });
                    layer.layerInfos = newLayerInfos;
                }
            }, this);

            return originalLayerInfos;
        },

        _revertWMSLayerInfos: function (originalLayerInfos) {
            ct_lang.forEachProp(originalLayerInfos, function (layerInfos, name) {
                var layer = ctArrayExtension.arrayStringSearchFirst(this.layers, "id", name);
                layer && (layer.layerInfos = layerInfos);
            }, this);
        },

        _replaceLayerInfoBySubLayerInfos: function (layerInfo, layer) {
            var subLayers = layerInfo.subLayers || [];
            if (!subLayers.length) {
                return [layer.getLayerInfo(layerInfo.name)];
            }
            var subLayerInfos = [];
            d_array.forEach(subLayers, function (subLayer) {
                subLayerInfos = subLayerInfos.concat(this._replaceLayerInfoBySubLayerInfos(subLayer, layer));
            }, this);
            return subLayerInfos;
        }
    });
});