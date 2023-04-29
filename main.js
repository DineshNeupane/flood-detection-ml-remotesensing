/*initial data requirements*/

var outline_pajaro = Table; //load from assets, shapefile of area
var water = FeatureCollection(); //given training inputs for water
var vegetation = FeatureCollection(); //given training inputs for vegetation
var buildings = FeatureCollection(); //given training inputs for buildings
var fields = FeatureCollection(); //given training inputs for agri field
var cloud = FeatureCollection(); //given training inputs for cloud, cloud mask


//Load Sentinel-2 data and filter by date and area of interest
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


//Load Sentinel-2 data and filter by date and area of interest
var s2_old = ee.ImageCollection('COPERNICUS/S2_SR')
    .filterBounds(outline_pajaro)
    .filterDate('2023-02-05', '2023-02-09')
    .map(function(image) {
        return image.clip(outline_pajaro);
    });
print(s2_old)

// Display the true color map, sorted by cloudy pixel percentage
var trueColor = {
  bands: ['B4', 'B3', 'B2'],
  min: 0,
  max: 3000
};

Map.addLayer(
    s2_old.sort('CLOUDY_PIXEL_PERCENTAGE'),
    trueColor,
    'Old Image'
);

var ndwi = s2_old.median().normalizedDifference(['B3', 'B8']);
Map.addLayer(ndwi, {min: -1, max: 1, palette: ['black', 'blue']}, 'NDWI');


/*----------TRAINING THE CLASSIFER---------*/
var training_points = water.merge(vegetation).merge(buildings).merge(fields).merge(cloud)
print(training_points, 'training_points')
var bands_selection=["B4","B3","B2"];

//overlay
var training =s2.median().select(bands_selection).sampleRegions({
  collection:training_points,
  properties:['landcover'],
  scale:30
})

print(training,"training")
Export.table.toAsset({
  collection: training,
  description: 'trainingasset',
  assetId: 'trainingasset'
});

///SPLITS:Training(75%) & Testing samples(25%).
var Total_samples=training.randomColumn('random')
var training_samples=Total_samples.filter(ee.Filter.lessThan('random',0.75))
print(training_samples,"Training Samples")
var validation_samples=Total_samples.filter(ee.Filter.greaterThanOrEquals('random',0.75))
print(validation_samples,"Validation_Samples")

/*SVM classifier*/
// var classifier = ee.Classifier.smileRandomForest(numberOfTrees, variablesPerSplit, minLeafPopulation, bagFraction, maxNodes, seed)
var classifier_rf=ee.Classifier.libsvm({ kernelType: 'RBF', gamma: 0.00005}).train({
features:training_samples,
classProperty:'landcover',
inputProperties:bands_selection
})

var classified=s2.median().select(bands_selection).classify(classifier_rf);

//TODO: Create a chart of the class areas over time

var palette = [
  'white',
  'blue', //cloud(0)
  'green',
  'yellow',
  'grey'
    ];
Map.addLayer(classified,{min: 0, max: 3,palette: palette},"classification");



// Define the export parameters.
var exportParams = {
  image: ndwi,
  description: 'my_ndwi',
  fileFormat: 'GeoTIFF',
  scale: 30,
  region: outline_pajaro // a geometry object defining the region of interest
};

// Export the image to your local disk.
Export.image.toDrive(exportParams);


var confusionMatrix =classifier_rf.confusionMatrix();
print(confusionMatrix,'Error matrix: ');
print(confusionMatrix.accuracy(),'Training Overall Accuracy: ');


// Get information about the trained classifier.
print('Results of trained classifier', classifier_rf.explain());


// Get a confusion matrix and overall accuracy for the validation sample.
var predictions  = validation_samples.classify(classifier_rf);
var validationAccuracy = predictions.errorMatrix('landcover', 'classification');
print('Validation error matrix', validationAccuracy);
print('Validation accuracy', validationAccuracy.accuracy())



// Get the original and predicted labels as lists
var original = validation_samples.aggregate_array('landcover');
var predicted = predictions.toList(predictions.size()).map(function(image) {
  return ee.Image(image).get('classification');
});


print(original)
print(predicted)

// Define the class names and colors
var classNames = ['water', 'vegetation', 'fields', 'building'];
var colors = ['blue', 'white', 'red', 'green'];

// Compute the area of each class for each date
var areas = classified.eq(ee.List.sequence(0, 4 - 1))
  .multiply(ee.List.sequence(1, 4))
  .reduce('sum')
  .rename(classNames);
  
// Create a chart of the class areas over time
var chart = ui.Chart.image.series({
  imageCollection: areas,
  region: outline_pajaro,
  reducer: ee.Reducer.sum(),
  scale: 30,
  xProperty: 'system:time_start'
}).setOptions({
  title: 'Class Areas Over Time',
  colors: colors
});
