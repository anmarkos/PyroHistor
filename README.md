"Programmatic generation of fire spread and extinguishment data with geostationary satellites."

Code Archive 

This repository contains the code required to reproduce the analysis in the article: 
"Programmatic generation of fire spread and extinguishment data with geostationary satellites."

Four text files are provided, three .js and one . ipynb. 
The javascript codes are essentially the same, but with 
different start, end dates, different areas of interest 
and minor adjustments to allow specific parts of the 
workflow and prevent crushes. 

Start viewing how the JS code works with the case study #2 
because it is a shorter event and its area of interest is 
smaller, so there will be no “out of memory” errors even 
with a GEE community tier. Once the events/complexes/days 
of interest are identified using a customized version of 
Code 1 the user can proceed to comment and uncomment 
sections of the code to sample and export all the data of 
interest, an example is provided in Code 2:

Workflow:
Run:
Code 1 PyroHistor_ROS_Measurement_Visualization#2.js
Code 2 PyroHistor_Visualization_Sampling_Export#2.js

Notice that the code is basically the same but Code 1, 
used to measure Rate of Spread, selects specific days 
and a smaller area of interest. Events that last months 
like the case study #1 go through too many stages of 
slow or even negative growth, so only segments of the 
event will be of interest for Rate of Spread measurements. 
Customization is required on a case by case basis.

Another change that you will notice in Code 3, the code 
provided to export the samples for case study #1, is that 
the .getInfo() method is avoided because it consumes too 
much memory and is likely to generate errors. 
Also, the resolution of the animated .gif file must be 
reduced to ensure successful processing and rendering. 
The parameter var dimensions was reduced from 380 to 150, 
everything else is just the same:
 
Run:
Code 3 PyroHistor_Visualization_Sampling_Export#1.js

The datasets exported and used in this article are also 
available in the repository, but in real use this is how 
to proceed. Once exported training and validation data 
can be found in the user’s selected Google Drive folder. 
CVS files can be accessed directly after mounting 
Google Drive in colab, or uploaded. Run the cells 
as in the Python code provided Code 4:

Open in colab:
Code 4 PyroHistor_Training_Test_Validation.ipynb

Run the entire process in essentially seven steps: 
1) Data uploading
2) Data inspection
3) Randomized subsampling stratifying the negative cases by hour when possible
4) Feature selection, model testing
5) Partial Dependence Plots
6) Model training
7) Model validation on a different dataset subjected to steps 1 and 3.
