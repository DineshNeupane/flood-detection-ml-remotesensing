var s2 = ee.ImageCollection('COPERNICUS/S2_SR')
    .filterBounds(outline_pajaro)
    .filterDate('2023-03-19', '2023-03-21')
    .map(function(image) {
        return image.clip(outline_pajaro);
    });
print(s2)

// Display the true color map, sorted by cloudy pixel percentage
var trueColor = {
  bands: ['B4', 'B3', 'B2'],
  min: 0,
  max: 3000
};

Map.addLayer(
    s2.sort('CLOUDY_PIXEL_PERCENTAGE'),
    trueColor,
    'New Image'
);


//Choose bands to include and define feature collection to use
var subset = s2.median().select('B[1-7]')
var samples = ee.FeatureCollection([water,vegetation,fields,building]);

var plotOptions = {
  title: 'Sentinel 2A  Surface reflectance spectra',
  hAxis: {title: 'Bands'},
  vAxis: {title: 'Surface Reflectance'},
  lineWidth: 1,
  pointSize: 4,
  series: {
    0: {color: 'blue'}, // Water
    1: {color: 'green'}, // Forest
    2: {color: 'red'},
    3: {color: 'grey'}// City
}};

// Create the scatter chart
var Chart1 = ui.Chart.image.regions(
    subset, samples, ee.Reducer.mean(), 10, 'label')
        .setChartType('ScatterChart').setOptions(plotOptions);
print(Chart1);
