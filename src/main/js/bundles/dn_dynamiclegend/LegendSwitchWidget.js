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
    "dijit/_WidgetBase",
    "dijit/_TemplatedMixin",
    "dijit/_WidgetsInTemplateMixin",
    "dojo/text!./templates/LegendSwitchWidget.html",
    "dijit/form/ToggleButton",
    "dijit/form/CheckBox"
], function (declare, _WidgetBase, _TemplatedMixin, _WidgetsInTemplateMixin, templateStringContent) {
    return declare([_WidgetBase, _TemplatedMixin, _WidgetsInTemplateMixin], {
        templateString: templateStringContent,
        baseClass: "legendSwitchWidget",
        setChecked: function (checked) {
            this.switchCheckBox.set("checked", checked);
        },

        _onSwitchChange: function (value) {
            this.onSwitch(value);
        },

        onSwitch: function (evt) {
        }
    });
});
