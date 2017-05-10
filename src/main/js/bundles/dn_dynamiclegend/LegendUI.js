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
    "dojo/dom-construct",
    "ct/_lang",
    "dijit/_Widget",
    "./LegendSwitchWidget",
    "./Legend"
], function (declare, d_domconstruct, ct_lang, _Widget, LegendSwitchWidget, Legend) {
    return declare([_Widget], {
        baseClass: "ctLegend",

        // expected to be provided
        i18n: null,
        esriMap: null,
        mapState: null,
        mapModel: null,
        legendToggleTool: null,
        showDynamicLegend: false,
        coordinateTransformer: null,

        //local
        _legend: null,
        _legendSwitchWidget: null,

        constructor: function (opts) {
            ct_lang.hasProps(opts, "esriMap", true, "No esriMap available!");
            ct_lang.hasProps(opts, "mapState", true, "No mapState available!");
            ct_lang.hasProps(opts, "mapModel", true, "No mapModel available!");
        },

        buildRendering: function () {
            this.inherited(arguments);
            this._createLegend();
        },

        destroy: function () {
            this.inherited(arguments);
            this._legend && this._legend.destroy();
            this._legendSwitchWidget && this._legendSwitchWidget.destroy();
        },

        show: function () {
            this._legend.refresh();
        },
        hide: function () {
            this._legend._deactivate();
        },

        _createLegend: function () {
            var domNode = this.domNode;
            //legend pane
            var legendNode = d_domconstruct.create("div", {}, domNode);
            this._legend = new Legend({
                i18n: this.i18n,
                map: this.esriMap,
                mapState: this.mapState,
                mapModel: this.mapModel,
                respectCurrentMapScale: this.respectCurrentMapScale,
                arrangement: this.alignmentLeft ? Legend.ALIGN_LEFT : Legend.ALIGN_RIGHT,
                showBaseLayer: this.showBaseLayer,
                layerInfos: this.layerInfos,
                autoUpdate: this.autoUpdate,
                legendToggleTool: this.legendToggleTool,
                showDynamicLegend: this.showDynamicLegend,
                coordinateTransformer: this.coordinateTransformer
            }, legendNode);

            //switch pane
            var legendSwitchWidget = this._legendSwitchWidget = new LegendSwitchWidget({i18n: this.i18n});
            d_domconstruct.place(legendSwitchWidget.domNode, domNode, "first");
            legendSwitchWidget.setChecked(this.showDynamicLegend);
            this.connect(legendSwitchWidget, "onSwitch", "_onSwitchHandler");
        },

        _onSwitchHandler: function (showDynamicLegend) {
            this.showDynamicLegend = showDynamicLegend;
            this._legend._setShowDynamicLegend(showDynamicLegend);
        }
    });
});