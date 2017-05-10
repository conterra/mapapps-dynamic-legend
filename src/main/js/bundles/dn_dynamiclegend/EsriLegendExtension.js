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
/**
 * @fileOverview
 * @author gli
 */


define([
    "dojo/_base/declare",
    "dojo/_base/lang",
    "dojo/_base/array",
    "dojo/_base/connect",
    "dojo/has",
    "dojo/DeferredList",
    "dojo/dom",
    "dojo/dom-class",
    "dojo/dom-construct",
    "dojo/dom-style",
    "dojox/html/entities",
    "apprt-request",
    "esri/dijit/Legend",
    "./ctArrayExtension"
], function (declare, d_lang, d_array, d_connect, has, DeferredList, d_dom, d_domClass, d_domConstruct, d_domStyle, d_entities, apprt_request, esriLegend, ctArrayExtension) {
    var getDomNodeById = d_dom.byId;
    var createDomNode = d_domConstruct.create;
    return declare([esriLegend], {
        _dynamicWarning: false,

        //Patch original method
        _createLegend: function () {
            var id = this.id;
            d_domStyle.set(this.domNode, "position", "relative");
            createDomNode("div", {id: id + "_msg", innerHTML: this.NLS_creatingLegend + "..."}, this.domNode);

            var hasWMSLegede = !1;
            var legendRequests = [];
            var showInLegendLayers = this._getShowInLegendLayers();
            d_array.forEach(showInLegendLayers, function (layer) {
                var declaredClass = layer.declaredClass;
                if (!layer.loaded) {
                    var k = d_connect.connect(layer, "onLoad", this, function () {
                        d_connect.disconnect(k);
                        k = null;
                        this.refresh()
                    })
                }
                else if (layer.visible === !0) {
                    var layerId = layer.id;
                    var layerLegendNode = createDomNode("div", {id: id + "_" + layerId, style: "display: none;", "class": "esriLegendService"}, this.domNode, "first");
                    if ("esri.layers.WMSLayer" == declaredClass) {
                        d_domClass.add(layerLegendNode, "lfuLegendWMSLayer");
                        //patched
                        hasWMSLegede = this._createLegendForWMSLayer(layerLegendNode, layer);
                        if (hasWMSLegede) {
                            var serverNode = this._createServiceLabelNode(layerLegendNode.parentNode || this.domNode, d_entities.encode(layer._titleForLegend || layer.name || layerId));
                            var dynamicWarning = this._dynamicWarning = hasWMSLegede && this._isDynamicLegend();
                            //dynamicWarning && this._createNoDynamicAvailableLabelNode(serverNode);

                            d_domStyle.set(layerLegendNode, "display", "block");
                        }
                    }
                    else if (layer.layerInfos || layer.renderer || "esri.layers.ArcGISImageServiceLayer" == declaredClass) {
                        //patched
                        this._createServiceLabelNode(layerLegendNode.parentNode || this.domNode, this._getServiceTitle(layer));
                        layer.legendResponse || layer.renderer ? this._createLegendForLayer(layer) : legendRequests.push(this._legendRequest(layer))
                    }
                }
            }, this);

            var msgNode = getDomNodeById(id + "_msg");
            if (legendRequests.length === 0 && !hasWMSLegede) {
                msgNode && (msgNode.innerHTML = this.NLS_noLegend);
                this._activate();
            }
            else {
                var that = this;
                new DeferredList(legendRequests).addCallback(function () {
                    msgNode && (msgNode.innerHTML = hasWMSLegede ? "" : that.NLS_noLegend);
                    that._activate();
                })
            }
        },

        _createLegendForWMSLayer: function (parent, layer) {
            var hasLegende = false;
            var dynamicWarning = this._isDynamicLegend();
            var visibleLayers = layer.visibleLayers;
            for (var i = visibleLayers.length - 1; i > -1; i--) {
                var layerInfo = ctArrayExtension.arrayStringSearchFirst(layer.layerInfos, "name", visibleLayers[i]);
                if (layerInfo && !this._isExcludeLayer(layerInfo)) {
                    var legendImgTitle = layerInfo.title || layerInfo.name || layerInfo.id;
                    var titleNode = this._createLayerLabelNode(parent, legendImgTitle);
                    dynamicWarning && this._createNoDynamicAvailableLabelNode(titleNode);

                    hasLegende = this._buildLegendItems_Config(layer, layerInfo, parent);

                    var legendURL = layerInfo.legendURL;
                    var hasServerLegendItemAtCurrentScale = !hasLegende || legendURL && this._getLegendItemsAtCurrentScale(layerInfo, false).length > 0;
                    if (hasServerLegendItemAtCurrentScale) {
                        var tbody = this._createLegendLayerTbodyNode(parent, layer, layerInfo);
                        var imgTdNode = createDomNode("td", {}, createDomNode("tr", {}, tbody));

                        var imgNode = createDomNode("img", {src: apprt_request.getProxiedUrl(legendURL), title: legendImgTitle, border: 0, style: "opacity:" + layer.opacity, "class": "lfuLegendImg"}, imgTdNode);
                        if (9 > has("ie")) {
                            d_domStyle.set(imgNode, "filter", "alpha(opacity\x3d" + 100 * layer.opacity + ")");
                        }

                        hasLegende = true;
                    }
                }
            }

            return hasLegende;
        },

        //Patch original method
        _buildLegendItems: function (layer, layerInfo, idx) {
            var legendNodeId = this.id + "_" + layer.id;
            var parentLayerId = layerInfo.parentLayerId;
            var legendLayerNodeId = legendNodeId + "_" + layerInfo.id;

            var hasLegende = !1;
            var notParentLayer = parentLayerId == -1;
            var layerLegendNode = notParentLayer ? getDomNodeById(legendNodeId) : getDomNodeById(legendNodeId + "_" + parentLayerId + "_group");

            var layerLabelParentNode = null;
            if (layerInfo.subLayerIds) {
                layerLabelParentNode = createDomNode("div", {
                        id: legendLayerNodeId + "_group",
                        style: {display: "none"},
                        "class": notParentLayer ? (0 < idx ? "esriLegendGroupLayer" : "") : this._legendAlign
                    },
                    layerLegendNode);

                this._createLayerLabelNode(layerLabelParentNode, layerInfo.name);
            }
            else if ((!this._respectVisibility || !layer.visibleLayers || -1 != ("," + layer.visibleLayers + ",").indexOf("," + layerInfo.id + ",")) && !this._isExcludeLayer(layerInfo) && this._showAtItemCount(layerInfo)) {
                layerLabelParentNode = createDomNode("div", {
                        id: legendLayerNodeId,
                        "class": notParentLayer ? "" : this._legendAlign
                    },
                    layerLegendNode);

                //patched
                this._dynamicWarning = false;
                var layerLabelNode = this._createLayerLabelNode(layerLabelParentNode, layerInfo.name);

                hasLegende = this._buildLegendItems_Config(layer, layerInfo, layerLabelParentNode);
                var hasServerLegendItemAtCurrentScale = !hasLegende || this._getLegendItemsAtCurrentScale(layerInfo, false).length > 0;
                if (hasServerLegendItemAtCurrentScale) {
                    if (layer.legendResponse && this._buildLegendItems_Tools(layer, layerInfo, layerLabelParentNode) || layer.renderer && this._buildLegendItems_Renderer(layer, layerInfo, layerLabelParentNode)) {
                        hasLegende = !0;
                    }
                }

                this._dynamicWarning && this._createNoDynamicAvailableLabelNode(layerLabelNode);
                !hasLegende && d_domStyle.set(layerLabelParentNode, "display", "none");
            }

            return hasLegende;
        },
        //Patch original method
        _buildLegendItems_Tools: function (layer, layerInfo, parent) {
            var scale = this.map.getScale(), hasLegend = !1, _getLegendResponseLayer = function (a, b) {
                var c, d;
                for (c = 0; c < a.length; c++)if (b.dynamicLayerInfos)for (d = 0; d < b.dynamicLayerInfos[d].length; d++) {
                    if (b.dynamicLayerInfos[d].mapLayerId == a[c].layerId)return a[c]
                } else if (b.id == a[c].layerId)return a[c];
                return {}
            };
            if (!this._respectCurrentMapScale || this._isLayerInScale(layer, layerInfo, scale)) {
                var u = !0;
                var declaredClass = layer.declaredClass;
                if (this._respectCurrentMapScale && ("esri.layers.ArcGISDynamicMapServiceLayer" === declaredClass || "esri.layers.ArcGISMapServiceLayer" === declaredClass)) {
                    var n = this._getEffectiveScale(layer, layerInfo);
                    if (n.minScale && n.minScale < scale || n.maxScale && n.maxScale > scale) u = !1
                }
                if (u) {
                    var legendResponseLayer = _getLegendResponseLayer(layer.legendResponse.layers, layerInfo), legendType = legendResponseLayer.legendType, l = legendResponseLayer.legend;
                    if (l) {
                        "esri.layers.ArcGISImageServiceLayer" !== declaredClass && this._sanitizeLegendResponse(layer, legendResponseLayer, layerInfo);

                        var f = this._createLegendLayerTbodyNode(parent, layer, layerInfo);

                        //Dynamic Legend
                        var isDynamicLegend = this._isDynamicLegend();
                        var hasServerLegendItemAtCurrentScale = !0;
                        if (isDynamicLegend) {
                            d_array.forEach(l, function (c, idx) {
                                if (!(10.1 <= layer.version && !c.values && 1 < l.length && (layer._hideDefaultSymbol || "\x3call other values\x3e" === c.label || !c.label && !("esri.layers.ArcGISImageServiceLayer" === declaredClass && 10.3 <= layer.version))))
                                    if (c.url && 0 === c.url.indexOf("http") || c.imageData && 0 < c.imageData.length)
                                    //patched
                                        if (this._showDynamicLegendSymbolAtItemCount(layerInfo, c, idx)) {
                                            hasLegend = !0;
                                            this._buildRow_Tools(c, f, layer, layerInfo.id, legendType);
                                        }
                            }, this);

                            //Config Static Legend
                            hasServerLegendItemAtCurrentScale = !hasLegend;
                            if (hasServerLegendItemAtCurrentScale) {
                                hasLegend = this._buildLegendItems_Config(layer, layerInfo, parent, true);
                                hasServerLegendItemAtCurrentScale = !hasLegend || this._getLegendItemsAtCurrentScale(layerInfo, false, true).length > 0;
                                this._dynamicWarning = hasLegend || hasServerLegendItemAtCurrentScale;
                            }
                        }

                        //Static Legend
                        hasServerLegendItemAtCurrentScale && d_array.forEach(l, function (c) {
                            if (!(10.1 <= layer.version && !c.values && 1 < l.length && (layer._hideDefaultSymbol || "\x3call other values\x3e" === c.label || !c.label && !("esri.layers.ArcGISImageServiceLayer" === declaredClass && 10.3 <= layer.version))))
                                if (c.url && 0 === c.url.indexOf("http") || c.imageData && 0 < c.imageData.length)
                                    hasLegend = !0;
                            this._buildRow_Tools(c, f, layer, layerInfo.id, legendType);
                        }, this);
                    }
                }
            }
            if (hasLegend) {
                d_domStyle.set(getDomNodeById(this.id + "_" + layer.id + "_" + layerInfo.id), "display", "block");
                var parentLayerId = layerInfo.parentLayerId;
                if (-1 < parentLayerId) {
                    d_domStyle.set(getDomNodeById(this.id + "_" + layer.id + "_" + parentLayerId + "_group"), "display", "block");
                    this._findParentGroup(layer.id, layer, parentLayerId);
                }
            }
            return hasLegend
        },

        //Patch original method
        _buildRow_Tools: function (legendResponseItem, parentNode, layer, serverLayerId, legendType) {
            var trNode = createDomNode("tr", {}, parentNode);
            var labelTdNode, imgTdNode;
            if (this.alignRight) {
                labelTdNode = createDomNode("td", {align: this._isRightToLeft ? "left" : "right"}, trNode);
                imgTdNode = createDomNode("td", {align: this._isRightToLeft ? "left" : "right", width: 35}, trNode);
            }
            else {
                imgTdNode = createDomNode("td", {width: 35, align: "center"}, trNode);
                labelTdNode = createDomNode("td", {}, trNode);
            }

            var imgUrl = legendResponseItem.url;
            var label = d_entities.encode(legendResponseItem.label);
            var type = legendResponseItem.type;
            var imgNode, txtNode;
            if (!type || type == "img") {
                var declaredClass = layer.declaredClass;
                if ((!has("ie") || 9 <= has("ie") || 9 > has("ie") && "esri.layers.ArcGISImageServiceLayer" === declaredClass) && legendResponseItem.imageData && 0 < legendResponseItem.imageData.length) {
                    imgUrl = "data:image/png;base64," + legendResponseItem.imageData;
                }
                else if (0 !== imgUrl.indexOf("http")) {
                    imgUrl = layer.url + "/" + serverLayerId + "/images/" + imgUrl;
                    var queryToken = layer._getToken();
                    if (queryToken) {
                        imgUrl += "?token\x3d" + queryToken;
                    }
                    imgUrl = apprt_request.getProxiedUrl(imgUrl);
                }

                imgNode = createDomNode("img", {
                    src: imgUrl,
                    border: 0,
                    style: "opacity:" + layer.opacity
                }, imgTdNode);

                txtNode = this._createTdNode(labelTdNode, label, "", {dir: "ltr"});
            }
            else {
                //patched
                imgNode = createDomNode("span", {border: 0, "class": "lfuLegendLink icon-arrow-double-right"}, imgTdNode);
                txtNode = this._createTdNode(labelTdNode, "", "", {dir: "ltr"});
                if (type == "label") {
                    //createDomNode("span", {innerHTML: d_entities.encode(legendResponseItem.layerName) + "<br>", "class": "lfuLegendLayerLabel"}, txtNode);
                    createDomNode("span", {innerHTML: label, "class": "lfuLegendLayerLabel"}, txtNode);
                }
                else {
                    createDomNode("a", {
                        href: imgUrl,
                        title: this.i18n.ui.openExtraLink,
                        innerHTML: label,
                        "class": "lfuLegendLink",
                        "target": "_blank"
                    }, txtNode);
                }
            }

            if ("Stretched" === legendType && 10.3 <= layer.version && "esri.layers.ArcGISImageServiceLayer" === declaredClass) {
                d_domStyle.set(txtNode, {verticalAlign: "top", lineHeight: "1px"});
                d_domStyle.set(imgNode, {marginBottom: "-1px", display: "block"});
                d_domStyle.set(labelTdNode, {verticalAlign: "top"});
            }
            if (9 > has("ie")) {
                d_domStyle.set(imgNode, "filter", "alpha(opacity\x3d" + 100 * layer.opacity + ")");
            }
        },

        //Patch original method
        _sanitizeLegendResponse: function (a, b, c) {
            var d = b.legend;
            if (10.1 <= a.version && 1 < d.length && !b._sanitized) {
                a = d_lang.getObject("layerDefinition.drawingInfo.renderer", !1, c) || d_lang.getObject("drawingInfo.renderer", !1, c);

                var e, g;
                a && d_array.some(d, function (a) {
                    if (a.values)return !0
                }) && d_array.some(d, function (a, b) {
                    a.values || (g = b, e = a);
                    return !!e
                });

                e && d.splice(g, 1);
                a && (a.type === "classBreaks") && d.reverse();
                e && d.push(e);
                b._sanitized = !0
            }
        },

        //Patch original method
        _processLegendResponse: function (layer, response) {
            if (response && response.layers) {
                layer.legendResponse = response;

                var layerLegendNode = getDomNodeById(this.id + "_" + layer.id);
                //patched
                layerLegendNode && d_domConstruct.empty(layerLegendNode);
                //layerLegendNode && this._createServiceLabelNode(layerLegendNode.parentNode || this.domNode, this._getServiceTitle(layer));

                this._createLegendForLayer(layer);
            }
            else {
                this.inherited(arguments);
            }
        },

        _buildLegendItems_Config: function (layer, layerInfo, parent, isStaticLegend) {
            var tbody = null;
            var legendItems = this._getLegendItemsAtCurrentScale(layerInfo, true, isStaticLegend);
            var hasLegende = legendItems.length > 0;
            hasLegende && d_array.forEach(legendItems, function (item) {
                var legendResponseItem = {
                    url: item.url,
                    type: item.type,
                    label: item.title || "",
                    layerName: layerInfo.name || layerInfo.id
                };
                !tbody && (tbody = this._createLegendLayerTbodyNode(parent, layer, layerInfo));
                this._buildRow_Tools(legendResponseItem, tbody, layer, layerInfo.id);
            }, this);

            this._dynamicWarning = hasLegende && this._isDynamicLegend() && (isStaticLegend || !this._hasDynamicLegend(layerInfo));
            return hasLegende;
        },

        _createLegendLayerTbodyNode: function (parent, layer, layerInfo) {
            var tableNode = createDomNode("table", {cellpadding: 0, cellspacing: 0, width: "98%", "class": "esriLegendLayer lfuLegendLayer"}, parent);
            var tbodyNode = createDomNode("tbody", {}, tableNode);
            (layer._hoverLabel || layer._hoverLabels) && this._createHoverAction(tableNode, layer, layerInfo);
            return tbodyNode;
        },

        _createTdNode: function (parent, tdInnerHTML, tableClass, tableAttr, position) {
            var attr = d_lang.mixin({"class": tableClass, width: "98%"}, tableAttr || {});
            return createDomNode("td", {align: this._align, innerHTML: tdInnerHTML || ""}, createDomNode("tr", {}, createDomNode("tbody", {}, createDomNode("table", attr, parent, position))));
        },

        _createServiceLabelNode: function (parent, innerHTML) {
            return this._createTdNode(parent, innerHTML, "esriLegendServiceLabel", undefined, "first");
            //return parent;
        },
        _createLayerLabelNode: function (parent, innerHTML) {
            return this._createTdNode(parent, d_entities.encode(innerHTML), "esriLegendLayerLabel");
        },
        _createNoDynamicAvailableLabelNode: function (parent) {
            return createDomNode("span", {
                //"innerHTML": d_entities.encode(this.i18n.ui.noDynamicLegendAvailable),
                "title": this.i18n.ui.noDynamicLegendAvailable,
                "class": "lfuLegendNoDynamicAvailableLabel icon-sign-warning"
            }, parent);
        },
        _getShowInLegendLayers: function () {
            var showInLegendLayers = [];
            d_array.forEach(this.layers, function (layer) {
                if (!this._isDynamicLegend() || this._hasItemInExtent(layer)) {
                    var declaredClass = layer.declaredClass;
                    if ("esri.layers.WMSLayer" == declaredClass || "esri.layers.KMLLayer" == declaredClass || "esri.layers.GeoRSSLayer" == declaredClass) {
                        if (layer.loaded) {
                            if ("esri.layers.WMSLayer" == declaredClass) {
                                var hasLegendURL = layer.visible && d_array.some(layer.layerInfos, function (layerInfo) {
                                        return layerInfo.legendURL;
                                    });

                                hasLegendURL && showInLegendLayers.push(layer);
                            }
                            else {
                                var featureLayers = ("esri.layers.KMLLayer" == declaredClass) ? layer.getLayers() : layer.getFeatureLayers();
                                var hideLayersInLegend = layer._hideLayersInLegend;
                                if (hideLayersInLegend) {
                                    featureLayers = d_array.filter(featureLayers, function (featureLayer) {
                                        return -1 == d_array.indexOf(hideLayersInLegend, featureLayer.id)
                                    })
                                }

                                d_array.forEach(featureLayers, function (featureLayer) {
                                    if ("esri.layers.FeatureLayer" == featureLayer.declaredClass && layer._titleForLegend) {
                                        var title = "";
                                        switch (featureLayer.geometryType) {
                                            case "esriGeometryPoint":
                                                title = this.NLS_points;
                                                break;
                                            case "esriGeometryPolyline":
                                                title = this.NLS_lines;
                                                break;
                                            case "esriGeometryPolygon":
                                                title = this.NLS_polygons;
                                                break;
                                        }

                                        featureLayer._titleForLegend = layer._titleForLegend + " - " + title;
                                        showInLegendLayers.push(featureLayer);
                                    }
                                }, this);
                            }
                        } else {
                            d_connect.connect(layer, "onLoad", d_lang.hitch(this, function () {
                                this.refresh(this.layerInfos)
                            }));
                        }
                    }
                    else {
                        showInLegendLayers.push(layer);
                    }
                }
            }, this);

            return showInLegendLayers;
        }
    });
});
