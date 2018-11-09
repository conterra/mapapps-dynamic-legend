# Dynamic Legend Bundle
The Dynamic Legend bundle extends the esri legend to make it dynamic.

Sample App
------------------
https://demos.conterra.de/mapapps/resources/apps/downloads_dynamic_legend/index.html

Installation Guide
------------------
**Requirement: map.apps 3.4.0**

In order to use the "dn_dynamiclegend" bundle, simply add it to your app - no further configuration is required.

#### Configurable Components:
```
"dn_dynamiclegend": {
    "Legend": {
        "showDynamicLegend": true,
        "legendOpts": {
            // legend aligned to the left (if 'false' alignment is right)
            "alignmentLeft": true,
            // will update with every scale change and displays only the layers and sub layers that are visible in the current map scale
            "respectCurrentMapScale": true,
            // if false, baselayer information is not shown in the legend, but a message like "no legend available" is displayed
            "showBaseLayer": false
        }
    }
}
```

Development Guide
------------------
### Define the mapapps remote base
Before you can run the project you have to define the mapapps.remote.base property in the pom.xml-file:
`<mapapps.remote.base>http://%YOURSERVER%/ct-mapapps-webapp-%VERSION%</mapapps.remote.base>`

##### Other methods to to define the mapapps.remote.base property.
1. Goal parameters
`mvn install -Dmapapps.remote.base=http://%YOURSERVER%/ct-mapapps-webapp-%VERSION%`

2. Build properties
Change the mapapps.remote.base in the build.properties file and run:
`mvn install -Denv=dev -Dlocal.configfile=%ABSOLUTEPATHTOPROJECTROOT%/build.properties`
