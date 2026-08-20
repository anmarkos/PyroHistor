Map.setOptions('HYBRID')//.setControlVisibility(false);

var timeZone = 'America/La_Paz';
var timeDiff = ee.Date(Date.now()).difference(ee.Date(Date.now()).format({timeZone:timeZone}), 'hour').round().aside(print); 
var case_study = 'Bolivia_2021';      var prevYear = 2020;  var start = ee.Date('2021-08-18').advance(timeDiff,'hour');   var end =   ee.Date('2021-08-25').advance(timeDiff,'hour');  
var AOI = ee.Geometry.Polygon([-59.98974943066083,-18.205599744274675,-60.2094622104145,-18.232993261614517,-60.142170594968384,-18.692785964368202,-60.1041690704247,-18.90677957473196,-59.885386965028374,-19.41184129861138,-59.443222031643245,-19.38982164725067,-59.98974943066083,-18.205599744274675])
Map.centerObject(AOI);
var exportAOI = AOI.bounds();
Map.addLayer(AOI,{},'AOI')

// var oeel=require('users/OEEL/lib:loadAll');
// Map.addLayer(oeel.Map.scaleLayer({mapScale:Map.getScale(),point: scaleBar, direction:'left'}),{},'Scale Bar');
// var widget=oeel.Map.symbol({symbol:'arrow', fontWeight: 'bold', colorFont:'black', colorSymbol1:'white', colorSymbol2:'black'});
// widget.style().set({position:'top-left'});
// Map.add(widget);

//  SAMPLING PARAMETERS burned
var maxDistance = 4
var numPoints = 100
var lookBack = 120   //  to save memory when exporting set this paraemter to:  #1 1079h; #2 173h;
//   under dry conditions flaming combustion may re-activate or re-pass weeks or months later, determine this parameter empirically for each case study

//  ANIMATION PARAMETERS
var opacity = 1
var dimensions = 380    //  380  160;
var framesPerSecond = 1;

// utils
var days = ee.Number(end.difference(start, 'day'));
var hours = days.multiply(24).subtract(1);
var minutes = hours*60
var proj = ee.ImageCollection("COPERNICUS/S2_SR_HARMONIZED").filterBounds(AOI).filterDate(start.advance(-1,'month'),end).first().select('B4').projection();
var GOES = ee.ImageCollection('NOAA/GOES/16/FDCF').filterDate('2017-05-24', '2024-10-17T18:20:20')
.merge(ee.ImageCollection('NOAA/GOES/19/FDCF').filterDate('2024-10-17T18:20:20', ee.Date(Date.now()))).filterDate(start.advance(-1,'hour'), end)
var crs = GOES.select('Power').first().projection();    var scale = crs.nominalScale().round().int();
var grid = AOI.coveringGrid(crs, scale);

// Explore other datasets to identify potential EWEs
// var MCD64A1 = ee.ImageCollection("MODIS/061/MCD64A1").filterDate('2019-08-01','2019-11-01')
// .map(function(x){return x.select(['BurnDate','Uncertainty']).updateMask(backGround)});
// Map.addLayer(MCD64A1.select('BurnDate'),{palette:['blue','green','yellow','orange','red']},'Day of Year')
// print(ui.Chart.image.series(MCD64A1.select('BurnDate'), AOI, ee.Reducer.count(), 463).setChartType('ColumnChart').setOptions({hAxis: {'title': 'Timeline'}, vAxis: {'title': 'MCD64A1'}}));
// var BurnDate = ee.ImageCollection([ee.Image(0).rename('BurnDate').addBands(ee.Image(0).rename('Uncertainty')).int(), MCD64A1.min().int()]).mosaic().clip(AOI)

// var GlobFire = ee.FeatureCollection("JRC/GWIS/GlobFire/v2/FinalPerimeters").filterBounds(point)
// Map.addLayer(GlobFire,{},'GlobFire');/*
// print(ee.Image(1).clip(GlobFire).multiply(ee.Image.pixelArea().clip(GlobFire)).reduceRegion({reducer: ee.Reducer.sum(), geometry:geometry, crs:proj, bestEffort:true}))

// ee.ImageCollection("FIRMS").select(0).filterDate(start,end).mosaic().map(function(x){return x.updateMask(backGround).rename('burned')})
// .merge(ee.ImageCollection("NASA/LANCE/NOAA20_VIIRS/C2").select(0).filterDate(start,end)).merge(ee.ImageCollection("NASA/LANCE/SNPP_VIIRS/C2").select(0).filterDate(start,end)).map(function(x){return x.updateMask(backGround).rename('burned')}).mosaic()

// Land cover, choose the one of your preference, exclude water and 
// keep in mind that national datasets are appropriate for fires crossing borders
var LC_Type4 = ee.ImageCollection("MODIS/061/MCD12Q1").filterDate(prevYear+'-01-01', prevYear+1+'-01-01').first().select('LC_Type4').clip(AOI)
LC_Type4 = LC_Type4.updateMask(LC_Type4.gt(0))
var MCD12Q1 = LC_Type4.reproject({crs:crs, scale:scale})
var backGround = MCD12Q1.gt(0).selfMask().updateMask(MCD12Q1.neq(7));
var pixelArea = backGround.multiply(ee.Image.pixelArea()).divide(10000);

//  GOOGLE/SATELLITE_EMBEDDING should make fuel caracterization more easily transferable to other sites
var EMB = ee.ImageCollection("GOOGLE/SATELLITE_EMBEDDING/V1/ANNUAL").filterDate(prevYear+'-01-01', prevYear+1+'-01-01')
.filterBounds(AOI)//.select(['A48', 'A49', 'A56', 'A58', 'A60', 'A11', 'A15', 'A20', 'A24', 'A21', 'A29', 'A39','A42', 'A43', 'A52', 'A62'])
.mosaic().updateMask(backGround).reproject({crs:crs, scale:scale});

//  Define the "event" and start the analsys delimiting it in space and time
//  Compute the maximum lookback window and use it to optimize memory usage
var event = GOES.filterDate(start.advance(-1,'hour'), end)
.map(function(x){var mask = x.select('Power').updateMask(backGround)
return x.updateMask(backGround)
.addBands(ee.Image(x.date().difference(start,'day')).round().int().updateMask(mask).rename('days_elapsed'))
.addBands(ee.Image(x.date().difference(start,'hour')).round().int().updateMask(mask).rename('hours_elapsed'))
.addBands(ee.Image(x.date().difference(start,'minute')).round().int().updateMask(mask).rename('minutes_elapsed'))
.copyProperties(x,['system:time_start'])});
// print(ui.Chart.image.series(event.select('Power'), AOI, ee.Reducer.sum(), scale).setChartType('ColumnChart').setOptions({hAxis: {'title': 'Timeline'}, vAxis: {'title': 'Fire Radiative ΣMW'}}));

var minMax_min = event.select('minutes_elapsed').reduce(ee.Reducer.minMax()).int()
var minMax_hour = event.select('hours_elapsed').reduce(ee.Reducer.minMax()).int()
var days_elapsed = event.select('days_elapsed').min().int();
var hours_elapsed = minMax_hour.select('hours_elapsed_min');
var minutes_elapsed = minMax_min.select('minutes_elapsed_min');
var fire_duration = minMax_hour.select(1).subtract(minMax_hour.select(0)).rename('Fire_Duration_h')
var Fire_Duration_h = fire_duration.reduceRegion(ee.Reducer.max(), AOI, scale, crs).getNumber('Fire_Duration_h').aside(print)

// // What type of fuels burned in the event?
// var palette_LC =  ['1c0dff','05450a','086a10','54a708','78d203','009900','b6ff05','f9ffa4','a5a5a5'];
// var names = ['0 Water Bodies >60%','1 Evergreen conifer trees and shrubs >1m','2 Evergreen  broadleaf and palmate trees and shrubs >1m','3 Deciduous needleleaf trees and shrubs >1m', '4 Deciduous broadleaf trees and shrubs >1m','5 Herbaceous annuals <2m, >60% broadleaf crops','6 Herbaceous annuals <2m, including cereal crops','7 Non-Vegetated Lands <10% vegetation','8 Built-up Lands, >30% impervious'];
// var renamed = LC_Type4.updateMask(minutes_elapsed).eq([0,1,2,3,4,5,6,7,8]).rename(names);
// var area = renamed.multiply(ee.Image.pixelArea().divide(10000));
// var classarea = area.reduceRegion({reducer: ee.Reducer.sum(), geometry: AOI, scale: LC_Type4.projection().nominalScale(), crs: LC_Type4.projection(), bestEffort: true});
// var areatot = ee.Number(classarea);
// print('Burned area by LC_Type4-MCD64A1: ', areatot);
// Map.addLayer(LC_Type4,{min:0,max:8,palette:palette_LC},'LC_Type4-MCD64A1');

//  TRAJECTORY   //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
var points = minutes_elapsed.addBands(days_elapsed).stratifiedSample({numPoints:1000, classBand:'minutes_elapsed_min', region:AOI, scale:scale, projection:crs, geometries:true})
var Origin = points.limit(1)
var distance_from_Origin = ee.Image(1).clip(Origin).fastDistanceTransform().clip(AOI).rename('distance_from_Origin')
var dots = minutes_elapsed.addBands(days_elapsed).addBands(distance_from_Origin).stratifiedSample({numPoints:1000, classBand:'minutes_elapsed_min', region:AOI, scale:scale, projection:crs, geometries:true})
var Destination = dots.sort('distance_from_Origin',false).limit(1);
var distance_to_Destination = ee.Image(1).clip(Destination).fastDistanceTransform().clip(AOI).rename('distance_to_Destination')

var Prog_To = Origin.merge(ee.FeatureCollection(ee.List.sequence(0, hours)
.map(function(n) {var incipit = start.advance(n, 'hour'); var finis = incipit.advance(1, 'hour');
var Burned = event.filterDate(start,finis).select('Power').mosaic().gt(0).int().rename('Burned');
var new_sample = Burned.addBands(distance_from_Origin).addBands(distance_to_Destination).addBands(minutes_elapsed).addBands(days_elapsed)
.stratifiedSample({numPoints:1000, classBand:'Burned', region:AOI, scale:scale, projection:crs, geometries:true});
var to = new_sample.sort('distance_to_Destination',true).limit(1);
return to})).flatten());

var Prog_From = Origin.merge(ee.FeatureCollection(ee.List.sequence(0, hours)
.map(function(n) {var incipit = start.advance(n, 'hour'); var finis = incipit.advance(1, 'hour');
var Burned = event.filterDate(start,finis).select('Power').mosaic().gt(0).int().rename('Burned');
var new_sample = Burned.addBands(distance_from_Origin).addBands(distance_to_Destination).addBands(minutes_elapsed).addBands(days_elapsed)
.stratifiedSample({numPoints:1000, classBand:'Burned', region:AOI, scale:scale, projection:crs, geometries:true});
var from = new_sample.sort('distance_from_Origin',false).limit(1);
return from})).flatten());

var Trajectory_To = ee.Geometry.MultiLineString(Prog_To.geometry().coordinates())
var Trajectory_From = ee.Geometry.MultiLineString(Prog_From.geometry().coordinates())


var min_Day = Prog_From.aggregate_min('days_elapsed');
var max_Day = Prog_From.aggregate_max('days_elapsed');
var min_Min = Prog_From.aggregate_min('minutes_elapsed_min');
var max_Min = Prog_From.aggregate_max('minutes_elapsed_min');
// var rangeVal = ee.Number(max_Min).subtract(ee.Number(min_Min));
// var minutes = rangeVal.getInfo()
// var mmin = (dist_trav/minutes)

var palette_Progress = ['cyan', 'green', 'chartreuse','yellowgreen',  'yellow', 'gold',  'orange', 'darkorange', 'orangered', 'red', 'firebrick', 'darkred']//'springgreen', 
Map.addLayer(days_elapsed, {min:min_Day.getInfo(),max:max_Day.getInfo(),palette:palette_Progress}, 'Days Elapsed');
Map.addLayer(minutes_elapsed, {min:min_Min.getInfo(),max:max_Min.getInfo(),palette:palette_Progress}, 'Minutes Elapsed');
Map.addLayer(Trajectory_To,{},'Fire Trajectory To Destination');
Map.addLayer(Trajectory_From,{},'Fire Trajectory From Origin');
Map.addLayer(Origin,{color:'black'},'Fire Origin');

var Day_0a = Prog_From.filter(ee.Filter.eq('days_elapsed', 0))
var Day_0b = Prog_To.filter(ee.Filter.eq('days_elapsed', 0))
var Day_0 = ee.FeatureCollection(ee.Algorithms.If(Day_0a.size().gte(2), Day_0a, Day_0b))
var Day_0_Trajectory = ee.Geometry.MultiLineString(Day_0.geometry().coordinates())
var Day_0_dist_trav = Day_0_Trajectory.length().round().int().getInfo()
var Day_0_min_Min = Day_0.aggregate_min('minutes_elapsed_min');
var Day_0_max_Min = Day_0.aggregate_max('minutes_elapsed_min');
var Day_0_rangeVal = ee.Number(Day_0_max_Min).subtract(ee.Number(Day_0_min_Min));
var Day_0_minutes = Day_0_rangeVal.getInfo()
var Day_0_mmin = (Day_0_dist_trav/Day_0_minutes)
Map.addLayer(ee.Image().byte() .paint({'featureCollection': Day_0_Trajectory, 'color': 1, 'width': 4}).visualize({'palette': 'white'}),{},'Day_0_Trajectory');

var Day_1a = Prog_From.filter(ee.Filter.eq('days_elapsed', 1))
var Day_1b = Prog_To.filter(ee.Filter.eq('days_elapsed', 1))
var Day_1 = ee.FeatureCollection(ee.Algorithms.If(Day_1a.size().gte(2), Day_1a, Day_1b))
var Day_1_Trajectory = ee.Geometry.MultiLineString(Day_1.geometry().coordinates())
var Day_1_dist_trav = Day_1_Trajectory.length().round().int().getInfo()
var Day_1_min_Min = Day_1.aggregate_min('minutes_elapsed_min');
var Day_1_max_Min = Day_1.aggregate_max('minutes_elapsed_min');
var Day_1_rangeVal = ee.Number(Day_1_max_Min).subtract(ee.Number(Day_1_min_Min));
var Day_1_minutes = Day_1_rangeVal.getInfo()
var Day_1_mmin = (Day_1_dist_trav/Day_1_minutes)
Map.addLayer(ee.Image().byte() .paint({'featureCollection': Day_1_Trajectory, 'color': 1, 'width': 4}).visualize({'palette': 'white'}),{},'Day_1_Trajectory');

var Day_2a = Prog_From.filter(ee.Filter.eq('days_elapsed', 2))
var Day_2b = Prog_To.filter(ee.Filter.eq('days_elapsed', 2))
var Day_2 = ee.FeatureCollection(ee.Algorithms.If(Day_2a.size().gte(2), Day_2a, Day_2b))
var Day_2_Trajectory = ee.Geometry.MultiLineString(Day_2.geometry().coordinates())
var Day_2_dist_trav = Day_2_Trajectory.length().round().int().getInfo()
var Day_2_min_Min = Day_2.aggregate_min('minutes_elapsed_min');
var Day_2_max_Min = Day_2.aggregate_max('minutes_elapsed_min');
var Day_2_rangeVal = ee.Number(Day_2_max_Min).subtract(ee.Number(Day_2_min_Min));
var Day_2_minutes = Day_2_rangeVal.getInfo()
var Day_2_mmin = (Day_2_dist_trav/Day_2_minutes)
Map.addLayer(ee.Image().byte() .paint({'featureCollection': Day_2_Trajectory, 'color': 1, 'width': 4}).visualize({'palette': 'white'}),{},'Day_2_Trajectory');

var Day_3a = Prog_From.filter(ee.Filter.eq('days_elapsed', 3))
var Day_3b = Prog_To.filter(ee.Filter.eq('days_elapsed', 3))
var Day_3 = ee.FeatureCollection(ee.Algorithms.If(Day_3a.size().gte(2), Day_3a, Day_3b))
var Day_3_Trajectory = ee.Geometry.MultiLineString(Day_3.geometry().coordinates())
var Day_3_dist_trav = Day_3_Trajectory.length().round().int().getInfo()
var Day_3_min_Min = Day_3.aggregate_min('minutes_elapsed_min');
var Day_3_max_Min = Day_3.aggregate_max('minutes_elapsed_min');
var Day_3_rangeVal = ee.Number(Day_3_max_Min).subtract(ee.Number(Day_3_min_Min));
var Day_3_minutes = Day_3_rangeVal.getInfo()
var Day_3_mmin = (Day_3_dist_trav/Day_3_minutes)
Map.addLayer(ee.Image().byte() .paint({'featureCollection': Day_3_Trajectory, 'color': 1, 'width': 4}).visualize({'palette': 'white'}),{},'Day_3_Trajectory');

var Day_4a = Prog_From.filter(ee.Filter.eq('days_elapsed', 4))
var Day_4b = Prog_To.filter(ee.Filter.eq('days_elapsed', 4))
var Day_4 = ee.FeatureCollection(ee.Algorithms.If(Day_4a.size().gte(2), Day_4a, Day_4b))
var Day_4_Trajectory = ee.Geometry.MultiLineString(Day_4.geometry().coordinates())
var Day_4_dist_trav = Day_4_Trajectory.length().round().int().getInfo()
var Day_4_min_Min = Day_4.aggregate_min('minutes_elapsed_min');
var Day_4_max_Min = Day_4.aggregate_max('minutes_elapsed_min');
var Day_4_rangeVal = ee.Number(Day_4_max_Min).subtract(ee.Number(Day_4_min_Min));
var Day_4_minutes = Day_4_rangeVal.getInfo()
var Day_4_mmin = (Day_4_dist_trav/Day_4_minutes)
Map.addLayer(ee.Image().byte() .paint({'featureCollection': Day_4_Trajectory, 'color': 1, 'width': 4}).visualize({'palette': 'white'}),{},'Day_4_Trajectory');

var Day_5a = Prog_From.filter(ee.Filter.eq('days_elapsed', 5))
var Day_5b = Prog_To.filter(ee.Filter.eq('days_elapsed', 5))
var Day_5 = ee.FeatureCollection(ee.Algorithms.If(Day_5a.size().gte(2), Day_5a, Day_5b))
var Day_5_Trajectory = ee.Geometry.MultiLineString(Day_5.geometry().coordinates())
var Day_5_dist_trav = Day_5_Trajectory.length().round().int().getInfo()
var Day_5_min_Min = Day_5.aggregate_min('minutes_elapsed_min');
var Day_5_max_Min = Day_5.aggregate_max('minutes_elapsed_min');
var Day_5_rangeVal = ee.Number(Day_5_max_Min).subtract(ee.Number(Day_5_min_Min));
var Day_5_minutes = Day_5_rangeVal.getInfo()
var Day_5_mmin = (Day_5_dist_trav/Day_5_minutes)
Map.addLayer(ee.Image().byte() .paint({'featureCollection': Day_5_Trajectory, 'color': 1, 'width': 4}).visualize({'palette': 'white'}),{},'Day_5_Trajectory');

// var Day_6a = Prog_From.filter(ee.Filter.eq('days_elapsed', 6))
// var Day_6b = Prog_To.filter(ee.Filter.eq('days_elapsed', 6))
// var Day_6 = ee.FeatureCollection(ee.Algorithms.If(Day_6a.size().gte(2), Day_6a, Day_6b))
// var Day_6_Trajectory = ee.Geometry.MultiLineString(Day_6.geometry().coordinates())
// var Day_6_dist_trav = Day_6_Trajectory.length().round().int().getInfo()
// var Day_6_min_Min = Day_6.aggregate_min('minutes_elapsed_min');
// var Day_6_max_Min = Day_6.aggregate_max('minutes_elapsed_min');
// var Day_6_rangeVal = ee.Number(Day_6_max_Min).subtract(ee.Number(Day_6_min_Min));
// var Day_6_minutes = Day_6_rangeVal.getInfo()
// var Day_6_mmin = (Day_6_dist_trav/Day_6_minutes)
// Map.addLayer(ee.Image().byte() .paint({'featureCollection': Day_6_Trajectory, 'color': 1, 'width': 4}).visualize({'palette': 'white'}),{},'Day_6_Trajectory');

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

var Hourly = ee.ImageCollection(ee.List.sequence(0, hours)
.map(function(n) {var incipit = start.advance(n, 'hour'); var finis = incipit.advance(1, 'hour');
// var doy = ee.Image(incipit.getRelative('day','year').round().int()).add(1).rename('doy');
var hour = ee.Image(incipit.getRelative('hour','day').round().int()).rename('hour');

var hours_elapsed = ee.Image(incipit.difference(start,'hour')).round().int().rename('hours_elapsed')

var Active_Fire_Area = ee.ImageCollection([ee.Image(0).int().rename('Active_Fire_Area'), hours_elapsed.gte(minMax_hour.select(0)).selfMask().multiply(pixelArea).int().rename('Active_Fire_Area')]).mosaic()
var Burned = Active_Fire_Area.gt(0).rename('Burned')   
var Extinguished_Fire_Area = ee.ImageCollection([ee.Image(0).int().rename('Extinguished_Fire_Area'), hours_elapsed.gt(minMax_hour.select(1)).selfMask().multiply(pixelArea).int().rename('Extinguished_Fire_Area')]).mosaic()

// // Burning = available to burn, but unburned so far vs. burning at the current time step
var Power = ee.ImageCollection([ee.Image(0).float().rename('Power'), event.filterDate(incipit,finis).select('Power').sum()]).mosaic()    
var Burning =  ee.ImageCollection([Burned.updateMask(Burned.eq(0)).uint8().rename('Burning'), Power.uint8().rename('Burning')]).mosaic().gt(0)

// Key Driver Analysis (KDA) and Causal inference
var Area = ee.ImageCollection([ee.Image(0).float().rename('Area'), event.filterDate(incipit.advance(-1,'hour'),incipit).select('Area').max().multiply(60.98).add(4000)]).mosaic();
var Depth = (Area.pow(2).add(Area.pow(2))).sqrt().rename('Depth')//D = diagonal del cuadrado de la misma Area

var ΣMW = ee.ImageCollection([ee.Image(0).float().rename('ΣMW'), GOES.filterDate(incipit.advance(-lookBack,'hour'),incipit).select('Power').sum().rename('ΣMW')]).mosaic();
var distance = ΣMW.gt(0).selfMask().fastDistanceTransform().rename('distance')
var focal_ΣMW = ΣMW.focalMax().rename('focal_ΣMW');

var pre_Power = ee.ImageCollection([ee.Image(0).float().rename('pre_Power'), event.filterDate(incipit.advance(-1,'hour'),incipit).select('Power').sum().rename('pre_Power')]).mosaic()        
var focal_pre_Power = pre_Power.focalMax().rename('focal_pre_Power');

return (Area.addBands(hour).addBands(Active_Fire_Area).addBands(Extinguished_Fire_Area).addBands(fire_duration).addBands(Power).addBands(Burning)
.addBands(Depth).addBands(ΣMW).addBands(focal_ΣMW).addBands(Burned).addBands(distance).addBands(pre_Power).addBands(focal_pre_Power)

// Extinguishing = has been burning so far vs. burning for the last time at the current time step
.addBands(Extinguished_Fire_Area.gt(0).rename('Extinguishing').updateMask(pre_Power.gt(0)))

// Spreading = available to burn, but unburned so far vs. burning for the first time at the current time step
.addBands(Burning.rename('Spreading').updateMask(ΣMW.eq(0)).updateMask(Burned.eq(0)))

).updateMask(backGround).set('system:time_start', incipit.millis());        //  unless you want to inner join, plot or visualize the series you don't need this memory consuming property!
}));

// print(ui.Chart.image.series(Hourly.select(['Extinguishing','Spreading']), AOI, ee.Reducer.sum(), scale).setChartType('AreaChart').setOptions({hAxis: {'title': 'Timeline'}, vAxis: {'title': 'Pixel count'}}));
// print(ui.Chart.image.series(Hourly.select(['Burning']), AOI, ee.Reducer.sum(), scale).setChartType('AreaChart').setOptions({hAxis: {'title': 'Timeline'}, vAxis: {'title': 'Pixel count'}}));
// print(ui.Chart.image.series(Hourly.select(['pre_ΣMW_Density','Power']), AOI, ee.Reducer.mean(), scale).setChartType('AreaChart').setOptions({hAxis: {'title': 'Timeline'}, vAxis: {'title': 'Pixel count'}}));
// print(ui.Chart.image.series(Hourly.select(['hours_elapsed','days_elapsed']), AOI, ee.Reducer.mean(), scale).setChartType('AreaChart').setOptions({hAxis: {'title': 'Timeline'}, vAxis: {'title': 'Pixel count'}}));

var panel = ui.Panel();

// panel.add(ui.Chart.image.histogram(fire_duration, AOI, scale))
// panel.add(ui.Chart.image.series(Hourly.select(['Extinguished_Fire_Area','Active_Fire_Area']), AOI, ee.Reducer.sum(), scale).setChartType('AreaChart').setOptions({hAxis: {'title': 'Timeline'}, vAxis: {'title': 'Hectares'}}))
panel.add(ui.Chart.image.series(Hourly.select('Power'), AOI, ee.Reducer.sum(), scale).setChartType('ColumnChart').setOptions({hAxis: {'title': 'Timeline'}, vAxis: {'title': 'MW (hourly Σ)'}}))
// Map.add(panel)/*
panel.add(ui.Label({value: 'Day 0: '+start.format({format:'YYYY-MM-dd', timeZone:timeZone}).getInfo(), style: {fontWeight: 'bold'}}));
panel.add(ui.Label('Distance Traveled: '+(Day_0_dist_trav/1000)+' km'));
panel.add(ui.Label('Minutes Elapsed Origin-Destination: '+Day_0_minutes+' min'));
panel.add(ui.Label('Avg. Spread Rate: '+Day_0_mmin+' m/min'));

panel.add(ui.Label({value: 'Day 1: '+start.advance(1,'day').format({format:'YYYY-MM-dd', timeZone:timeZone}).getInfo(), style: {fontWeight: 'bold'}}));
panel.add(ui.Label('Distance Traveled: '+(Day_1_dist_trav/1000)+' km'));
panel.add(ui.Label('Minutes Elapsed Origin-Destination: '+Day_1_minutes+' min'));
panel.add(ui.Label('Avg. Spread Rate: '+Day_1_mmin+' m/min'));

panel.add(ui.Label({value: 'Day 2: '+start.advance(2,'day').format({format:'YYYY-MM-dd', timeZone:timeZone}).getInfo(), style: {fontWeight: 'bold'}}));
panel.add(ui.Label('Distance Traveled: '+(Day_2_dist_trav/1000)+' km'));
panel.add(ui.Label('Minutes Elapsed Origin-Destination: '+Day_2_minutes+' min'));
panel.add(ui.Label('Avg. Spread Rate: '+Day_2_mmin+' m/min'));

panel.add(ui.Label({value: 'Day 3: '+start.advance(3,'day').format({format:'YYYY-MM-dd', timeZone:timeZone}).getInfo(), style: {fontWeight: 'bold'}}));
panel.add(ui.Label('Distance Traveled: '+(Day_3_dist_trav/1000)+' km'));
panel.add(ui.Label('Minutes Elapsed Origin-Destination: '+Day_3_minutes+' min'));
panel.add(ui.Label('Avg. Spread Rate: '+Day_3_mmin+' m/min'));

panel.add(ui.Label({value: 'Day 4: '+start.advance(4,'day').format({format:'YYYY-MM-dd', timeZone:timeZone}).getInfo(), style: {fontWeight: 'bold'}}));
panel.add(ui.Label('Distance Traveled: '+(Day_4_dist_trav/1000)+' km'));
panel.add(ui.Label('Minutes Elapsed Origin-Destination: '+Day_4_minutes+' min'));
panel.add(ui.Label('Avg. Spread Rate: '+Day_4_mmin+' m/min'));

panel.add(ui.Label({value: 'Day 5: '+start.advance(5,'day').format({format:'YYYY-MM-dd', timeZone:timeZone}).getInfo(), style: {fontWeight: 'bold'}}));
panel.add(ui.Label('Distance Traveled: '+(Day_5_dist_trav/1000)+' km'));
panel.add(ui.Label('Minutes Elapsed Origin-Destination: '+Day_5_minutes+' min'));
panel.add(ui.Label('Avg. Spread Rate: '+Day_5_mmin+' m/min'));

// panel.add(ui.Label({value: 'Day 6: '+start.advance(6,'day').format({format:'YYYY-MM-dd', timeZone:timeZone}).getInfo(), style: {fontWeight: 'bold'}}));
// panel.add(ui.Label('Distance Traveled: '+(Day_6_dist_trav/1000)+' km'));
// panel.add(ui.Label('Minutes Elapsed Origin-Destination: '+Day_6_minutes+' min'));
// panel.add(ui.Label('Avg. Spread Rate: '+Day_6_mmin+' m/min'));


// // ////////   LEGEND ////////////
var vis = {min: '0', max: max_Min.getInfo(), palette: palette_Progress};
function makeColorBarParams(palette) {return {bbox: [0, 0, 1, 0.1],dimensions: '100x10',format: 'png',min: 0,max: 1,palette: palette}}
var colorBar = ui.Thumbnail({image: ee.Image.pixelLonLat().select(0),params: makeColorBarParams(vis.palette),
style: {stretch: 'horizontal', margin: '0px 8px', maxHeight: '24px'},});
var legendLabels = ui.Panel({widgets: [ui.Label(vis.min, {margin: '4px 8px'}),              
ui.Label('-',{margin: '4px 8px', textAlign: 'center', stretch: 'horizontal'}),  
ui.Label(vis.max, {margin: '4px 8px'})],layout: ui.Panel.Layout.flow('horizontal')});      
var legendTitle = ui.Label({value: 'Minutes elapsed since fire event inception',style: {fontWeight: 'bold'}});
var legendPanel = ui.Panel([legendTitle, colorBar, legendLabels]);

var backgroundColor = '#FFEFD5';
var palette1= ['696969', 'FFFFFF', 'FFA500', 'FF0000'];
var names1 = ['Extinguished/Smoldering Fire', 'Active Fire (undetected)', 'Active Fire <1000 ΣMW/h', 'Active Fire ≥1000 ΣMW/h'];
var panel1 = ui.Panel({style: {width: '300px', position: 'bottom-left',padding: '8px 15px', backgroundColor: backgroundColor}});
var titulopanel1 = ui.Label({value: 'Fire Status Legend', style: {fontWeight: 'bold', fontSize: '26px', margin: '0 0 4px 0', padding: '0', backgroundColor: backgroundColor}});
panel1=panel1
.add(titulopanel1)
.add(ui.Label({value: start.format({format:'YYYY-MM-dd HH:mm', timeZone:timeZone}).getInfo()+'h / '+end.format({format:'YYYY-MM-dd HH:mm', timeZone:timeZone}).getInfo()+'h', style:{backgroundColor: backgroundColor}}));
var makeRow1 = function(color, name) {
var colorBox = ui.Label({style: {backgroundColor: '#' + color,padding: '15px',margin: '0 0 4px 0'}});
var description = ui.Label({value: name,style: {margin: '0 0 4px 6px', fontSize: '17px', backgroundColor: backgroundColor}});
return ui.Panel({widgets: [colorBox, description], style: {backgroundColor: backgroundColor}, layout: ui.Panel.Layout.Flow('horizontal')});};
for (var i = 0; i < 4; i++) {panel1.add(makeRow1(palette1[i], names1[i]));}

var header1 = ui.Label('PyroHistor', {fontSize: '56px', fontWeight: 'bold', color: 'darkgreen'});
var sidePanel = ui.Panel({widgets:[header1], style:{width: '335px',position:'middle-right'}});
ui.root.insert(1,sidePanel);

var intro = ui.Label({value:'SCROLL DOWN TO VISUALIZE OUTPUTS:', style: {fontSize: '15px', fontWeight: 'bold', color: 'darkgreen'}});


//  Map a recent mosaic of the area of interest
var buffer = AOI.buffer(20000).bounds()
var roi = ee.Image(1).clip(buffer)
var HLS = ee.ImageCollection("NASA/HLS/HLSL30/v002").filterBounds(buffer).filterDate(start.advance(-3,'month'),start)
.merge(ee.ImageCollection("NASA/HLS/HLSS30/v002").filterBounds(buffer).filterDate(start.advance(-3,'month'),start))
HLS = HLS.map(function clean_HLS(x){
var qa = x.select('Fmask').updateMask(roi)
var a1 = qa.bitwiseAnd(1 << 1).neq(0);          // Bit 1: Cloud
var a2 = qa.bitwiseAnd(1 << 2).neq(0);          // Bit 2: Adjacent to cloud/shadow
var a3 = qa.bitwiseAnd(1 << 3).neq(0);          // Bit 3: Cloud shadow              shadowed pixels also needed for prediction
var a4 = qa.bitwiseAnd(1 << 4).neq(0);          // Bit 4: Snow/ice
var a5 = qa.bitwiseAnd(1 << 5).neq(0);          // Bit 5: Water     
var a6 = (qa.rightShift(6).bitwiseAnd(3)).eq(1) // Bits 6-7 Successfully measured Low aerosols
  
var maskHLS = a1.not().and(a2.not()).and(a3.not()) .and(a4.not()).and(a5.not())//.and(a6.not())
return x.select(['B4','B3','B2']).updateMask(maskHLS)}).median()//

// Animate and visualize fire spreading and extinguishment, checking for consistency

var aoi_outline = (ee.Image().byte() .paint({'featureCollection': AOI, 'color': 1, 'width': 0.5}).visualize({'palette': 'red'}));
var point_Origin = (ee.Image().byte() .paint({'featureCollection': Origin, 'color': 1, 'width': 1.5}).visualize({'palette': 'black'}));
var country_outline = (ee.Image().byte() .paint({'featureCollection': countries.filterBounds(point), 'color': 1, 'width': 0.5}).visualize({'palette': 'magenta'}));
var fire_prog = (ee.Image().byte() .paint({'featureCollection': Trajectory_From, 'color': 1, 'width': 1.5}).visualize({'palette': 'black'}));

// // some applications support only up to 1000 photograms
var VisP = Hourly//.limit(1000)
.map(function(x) {
var pt = text.getLocation(AOI, 'right', '2%', '35%');
var textVis = {fontSize: 36, textColor: 'ffffff', outlineColor: '000000', outlineWidth: 2.5, outlineOpacity: 1 };
var labeltxt = text.draw(x.get('system:index'), pt, 23000, textVis);

return HLS.select(['B4','B3','B2']).visualize({min: 0.015, max: 0.15, opacity: 1})
.blend(x.select('Active_Fire_Area').gt(0).selfMask().visualize({min:0,max:1,palette: ['FFFFFF'], opacity: opacity}))
.blend(x.select('Extinguished_Fire_Area').gt(0).selfMask().visualize({min:0,max:1,palette: ['696969'], opacity: opacity}))
// .blend(x.select('Spreading').updateMask(x.select('Spreading').gt(0)).visualize({min:0, max:1, palette: ['red'], opacity: opacity}))
.blend(x.select('Power').updateMask(x.select('Power').gt(0)).visualize({min:1, max:1000, palette: ['orange','red'], opacity: opacity}))
.blend(country_outline)//.blend(fire_prog.updateMask(x.select('Active_Fire_Area')))//.blend(labeltxt)
})
var gifParams = {'region': exportAOI,'dimensions': dimensions,'crs': crs, 'scale': scale,'framesPerSecond': framesPerSecond,'format': 'gif'};
// print(ui.Thumbnail(VisP, gifParams));    //   print(VisP.getVideoThumbURL(gifParams));  

sidePanel
.add(intro)
.add(panel)
.add(ui.Thumbnail(VisP, gifParams))
.add(panel1)
Map.add(legendPanel)
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/*
var merit = ee.Image('MERIT/Hydro/v1_0_1').select(['elv','upa','upg','hnd']).clip(AOI)
var topo = merit.addBands(ee.Terrain.slope(merit.select('elv'))).reproject({crs:crs, scale:scale})
// Map.addLayer(ee.ImageCollection("COPERNICUS/S2").filterDate(end.advance(5,'days'), end.advance(10,'days')).filterBounds(AOI).mosaic().clip(AOI.buffer(5000)).select(['B12', 'B8','B4']),{min:400,max:4000}, 'Sentinel 2');

var GFS = ee.ImageCollection("NOAA/GFS0P25")
.filter(ee.Filter.calendarRange(0, 0,'hour')).filterDate(start, end)
.filter(ee.Filter.lt('forecast_hours', 24))
.map(function(x){
var air_temp = x.select('temperature_2m_above_ground').resample('bilinear').reproject({crs:crs, scale:scale});
var rel_hum = x.select('relative_humidity_2m_above_ground').resample('bilinear').reproject({crs:crs, scale:scale});

var h = rel_hum; 
var T = (air_temp.multiply(9/5).add(32)); 

// calculate Equilibrium Moisture Content for each RH range of values
var m1 = (h.updateMask(h.lt(10)).multiply(0.281073).subtract(h.updateMask(h.lt(10)).multiply(0.000578).multiply(T)).add(0.03229));
var m2 = (h.updateMask(h.gte(10)).updateMask(h.lt(50)).multiply(0.160107).subtract(T.updateMask(h.gte(10)).updateMask(h.lt(50)).multiply(0.014784)).add(2.22749));
var m3 = ((h.updateMask(h.gte(50)).pow(2).multiply(0.005565)).subtract(h.updateMask(h.gte(50)).multiply(T.updateMask(h.gte(50))).multiply(0.00035)).subtract(h.updateMask(h.gte(50)).multiply(0.483199)).add(21.0606));
var m = ee.ImageCollection([m1,m2,m3]).mosaic().rename('equilibrium_mositure_content');
var MC_1h = m.multiply(1.03).rename('MC_1h');    

var es = x.expression('0.61078*exp(17.27*T/(T+237.3))', {T: air_temp}).rename('es');
var ea = es.multiply(rel_hum.divide(100));
var VPD_air = (es.subtract(ea)).rename('VPD_air');

var u = x.select('u_component_of_wind_10m_above_ground').resample('bilinear').reproject({crs:crs, scale:scale});
var v = x.select('v_component_of_wind_10m_above_ground').resample('bilinear').reproject({crs:crs, scale:scale});
var Wind_Speed_10m = ((u.pow(2).add(v.pow(2))).sqrt()).rename('Wind_Speed_10m');
var Wind_Speed_2m = Wind_Speed_10m.multiply(0.7944).rename('Wind_Speed_2m');
var Wind_Dir = ((v.atan2(u)).multiply(57.29577951)).add(180).rename('Wind_Dir');

var HDWI = VPD_air.divide(10).multiply(Wind_Speed_2m).rename('HDWI');

return (x.select(['specific_humidity_2m_above_ground','precipitable_water_entire_atmosphere']).resample('bilinear').reproject({crs:crs, scale:scale})
.addBands(air_temp).addBands(rel_hum).addBands(VPD_air).addBands(Wind_Speed_10m).addBands(Wind_Speed_2m).addBands(HDWI).addBands(Wind_Dir).addBands(MC_1h)).updateMask(backGround)
.set('system:time_start', x.get('forecast_time'))});

var innerJoin = ee.Join.inner();                              
var filterTimeEq = ee.Filter.equals({leftField: 'system:time_start',rightField: 'system:time_start'});
var innerJoined = innerJoin.apply(Hourly, GFS, filterTimeEq); 
var DATA = ee.ImageCollection(innerJoined.map(function(feature) {return ee.Image.cat(feature.get('primary'), feature.get('secondary'))})); 

var sample = DATA.map(function(x){
  var froude = x.select('Wind_Speed_10m').multiply(x.select('Depth').gt(0)).pow(2)
  .divide((x.select('Depth').multiply(9.81)).sqrt()).rename('froude')
  froude = froude.addBands(x.select('ΣMW')).addBands(x.select('pre_Power'))
  .addBands(x.select('Burned'))
  
  var angles = x.select('Wind_Dir').updateMask(x.select('Burning').eq(1))
  angles = angles.subtract(270)
  angles = ee.ImageCollection([angles.updateMask(angles.lt(0)).add(90),
  angles.updateMask(angles.gte(0)).subtract(270)]).mosaic()
  angles = angles.reduceRegions(grid, ee.Reducer.first(), scale, crs).filter(ee.Filter.notNull(['first']))

var dist_Froude = ee.ImageCollection(angles.map(function(x){
return froude.clip(x).directionalDistanceTransform(x.getNumber('first'), maxDistance, 'Burned')})).max().reproject({crs:crs,scale:scale})

dist_Froude = ee.ImageCollection([(ee.Image(0).rename('distance')
.addBands(ee.Image(0).rename('froude'))
.addBands(ee.Image(0).rename('ΣMW'))
.addBands(ee.Image(0).rename('pre_Power')))
.float(),dist_Froude]).mosaic()
return (x.addBands(dist_Froude).addBands(topo).addBands(EMB).addBands(MCD12Q1)//.addBands(BurnDate).addBands(fireFront).addBands(minMax_min)
.addBands(minMax_hour)).updateMask(backGround)});

// Burning = available to burn, but unburned so far vs. burning at the current time step
// Spreading = available to burn, but unburned so far vs. burning for the first time at the current time step
// Extinguishing = has been burning so far vs. burning for the last time at the current time step

Export.table.toDrive(sample.map(function(x){var seed = ee.Number(x.get('system:time_start')).divide(1000).int()
return x.stratifiedSample({numPoints: numPoints, classBand: 'Spreading', region: exportAOI, scale: scale, dropNulls : false,
projection: crs, seed: seed, tileScale: 16})}).flatten(), case_study+'_Spreading', 'fire', case_study+'_Spreading', 'CSV');

Export.table.toDrive(sample.map(function(x){var seed = ee.Number(x.get('system:time_start')).divide(1000).int()
return x.stratifiedSample({numPoints: numPoints, classBand: 'Extinguishing', region: exportAOI, scale: scale, dropNulls : false,
projection: crs, seed: seed, tileScale: 16})}).flatten(), case_study+'_Extinguishing', 'fire', case_study+'_Extinguishing', 'CSV');
/**/