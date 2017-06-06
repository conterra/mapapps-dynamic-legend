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
define(["dojo/_base/lang", "dojo/_base/declare", "./LegendUI"],
    function (d_lang, declare, LegendUI) {
        return declare([], {
            createInstance: function () {
                var properties = this._properties;
                var legendOpts = d_lang.mixin({}, properties.legendOpts || {}, {
                    showDynamicLegend: properties.showDynamicLegend,
                    i18n: this._i18n.get(),
                    esriMap: this._esriMap,
                    mapState: this._mapState,
                    mapModel: this._mapModel,
                    legendToggleTool: this._dynamicLegendToggleTool,
                    coordinateTransformer: this._coordinateTransformer
                });
                // create a new legend
                return new LegendUI(legendOpts);
            }
        });
    });