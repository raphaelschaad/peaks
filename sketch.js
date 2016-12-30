"use strict";

// {
//   "id": "...",
//   "type": "gipfel",
//   "name": {
//     "de": ["name1", "name2"],
//     "fr": "name3"
//   },
//   "e": 1.23,
//   "n": 4.56,
//   "z": 7.89
// }
var dataFilepath = "data/peaks.min.json";
var topoFilepath = "data/ch-topo.min.json";

var data;
var topo;
var countryLines = [];

// Grid
// ncol, nrow
// margin.{top,bottom,left,right}
// gutter (width)
// DERRIVED: colwidth(), colheight(), rowheight()
var grid;
/*
// DEBUG stuff
var isLooping = true;
// stats.js -- click panel to cycle through stats
var stats = new Stats();
// 0: fps, 1: ms, 2: mb, 3+: custom
stats.showPanel(0);
*/


// See setup() data definition section for more notes on colors
var colors = {};
var keyColors = {};
var typeColors = {};
var shadowColorsForColors = {};
var hoverColorsForColors = {};
var backgroundColor;
var darkColor;
var borderColor;
var foregroundColor;
var disabledColor;
var pressedColor;
var highlightShadowColor;

// UI
var cursorPopupDiv;

// Animation
var previousTime;
var popupCycleDelay = 2 * 1000; // in ms
var popupCycleRemaining = popupCycleDelay;
var idleHoverNoiseVector;
var idleHoverDelay = 15 * 1000; // in ms
var idleHoverRemaining = idleHoverDelay;

// Peak highlight
var highlightedPeaks = [];
var highlightedPeakCurrentPopup;

// Head
var logotypeImage;
var bylineDiv;
var aboutDiv;

// Filters: Peak name language, type, altitude
var checkboxesForLangs;
var checkboxesForTypes;
var altitudeControl;
var showInFeetDiv;
var shouldShowInFeet = false;
var coloredPeaks;

// Story 1: Language Share of Peak Names
var languageShareTitleDiv;
var namesPerLanguageDiv;
var showPerSpeakersDiv;
var shouldShowPerSpeakers = false;
var languagesDivs = [];

// Story 2: Most Common Peak Names
var topNamesTitleDiv;
var topNamesDivs = [];
var secondColWidthMax = -Infinity;

// Story 3: Peak Name Origins
var nameOriginTitleDiv;
var nameOriginTextDiv;


/*
 * Setup
 */

function setup() {
  createCanvas(1024, 640).parent("centerContainer");
  select("#centerContainer").size(width, height);

  // Precalculate stuff
  // Don't ever ever create p5 color() in draw() -- it's so expensive ... *(re)setting* color (stroke, fill) is surprisingly cheap.
  // Use the keyColors for key (legend) and other UI elements
  var keyColorIdx = 5;
  var keyColorSaturationFactor = 0.9;
  var keyColorBrightnessFactor = 0.6;
  Object.keys(colorHexesForLangs).forEach(function(lang, idx, langs) {
    var colorHexes = colorHexesForLangs[lang];
    colors[lang] = colorHexes.map(function(colorHex) {
      return color(colorHex);
    });
    var keyColor = colors[lang][keyColorIdx];
    // HSB uses same values as Sketch.app. `%`-suffix is needed for S & B.
    keyColor = color("hsba(" + round(hue(keyColor)) + ", " + round(saturation(keyColor) * keyColorSaturationFactor) + "%, " + round(brightness(keyColor) * keyColorBrightnessFactor) + "%, 1.0)");
    keyColors[lang] = keyColor;
  });
  Object.keys(colorHexesForTypes).forEach(function(type, idx, types) {
    typeColors[type] = color(colorHexesForTypes[type]);
  });

  for (lang in colors) {
    var langColors = colors[lang];
    for (var i = 0; i < langColors.length; i++) {
      var col = langColors[i];
      // Pre-calculate shadow colors
      shadowColorsForColors[col] = color("hsba(" + round(hue(col)) + ", " + 6 + "%, " + 5 + "%, " + 0.25 + ")");
      // Pre-calculate hover colors
      hoverColorsForColors[col] = color("hsba(" + round(hue(col)) + ", " + round(saturation(col)) + "%, " + round(brightness(col)*0.64) + "%, " + 0.15 + ")");
    }
  }

  // Other colors
  backgroundColor = color("#171613");
  darkColor = color("#050504");
  borderColor = color("hsla(0, 0%, 0%, 0.333)");
  foregroundColor = color("hsla(40, 8%, 100%, 0.45)");
  disabledColor = color("#262522");
  pressedColor = color("hsla(40, 10%, 100%, 0.2)");
  highlightShadowColor = color("hsla(0, 0%, 0%, 0.5)");

  // Pre-project and flatten array of coordinates
  var countryLine = topojson.feature(topo, topo.objects.ch);
  for (var i = 0; i < countryLine.features.length; i++) {
    var feature = countryLine.features[i];
    var coords = feature.geometry.coordinates;
    var lineSegments = [];
    for (var j = 0; j < coords.length; j++) {
      var coord = coords[j];
      var x = mapCoordX(coord[0]);
      var y = mapCoordY(coord[1]);
      lineSegments.push(x);
      lineSegments.push(y);
    }
    countryLines.push(lineSegments);
  }

  var lengthMin = 3;
  var lengthMax = 140;
  for (var i = 0; i < data.peaks.length; i++) {
    var peak = data.peaks[i];
    // Pre-calculate length of altitude lines
    peak["length"] = map(peak.z, data.zMin, data.zMax, lengthMin, lengthMax);

    // Pre-project peak E & N to X & Y
    peak["x"] = mapCoordX(peak.e);
    peak["y"] = mapCoordY(peak.n);
  }

  // For display names, replace all spaces with non-breaking html entities
  for (var i = 0; i < data.peaks.length; i++) {
    var peak = data.peaks[i];
    var langs = Object.keys(peak.name);
    for (var j = 0; j < langs.length; j++) {
      var lang = langs[j];
      var names = peak.name[lang];
      if (Array.isArray(names)) {
        for (var k = 0; k < names.length; k++) {
          var name = names[k];
          peak.name[lang][k] = replaceSpacesWithNonBreaking(name);
        }
      } else {
        var name = names;
        peak.name[lang] = replaceSpacesWithNonBreaking(name);
      }
    }
  }
  for (var i = 0; i < data.topNames.length; i++) {
    var nameCount = data.topNames[i];
    var name = Object.keys(nameCount)[0];
    var count = nameCount[name];
    delete data.topNames[i][name];
    name = replaceSpacesWithNonBreaking(name);
    data.topNames[i][name] = count;
  }

  // Animation
  // "use two different parts of the noise space, starting at 0 for x and 10,000 for y so that x and y can appear to act independently of each other" http://natureofcode.com/book/introduction/
  idleHoverNoiseVector = createVector(0, 10000);

  // Grid
  grid = new Grid(16, // px, top margin
    16, // px, bottom margin
    16, // px, left margin
    16, // px, right margin
    4, // # columns
    42, // px, gutter width
    28 // # rows
  );
  // Hide by default
  grid.togglevisibility();
  grid.help.isvisible = false;

  /*
  // DEBUG stuff
  if (!isLooping) {
    noLoop();
  }

  document.body.appendChild(stats.domElement);

  $("#peaks-about-modal").modal();
  */
}


/*
 * Draw
 */

function draw() {
  background(backgroundColor);

  /*
  // DEBUG stuff
  grid.display();
  fill("#ff7f7f");
  noStroke();
  text(nf(frameRate(), 2, 1), 10, 20);
  stats.update();
  */


  // Animation
  if (previousTime === undefined) {
    previousTime = millis();
  }
  var currentTime = millis();
  var elapsedTime = currentTime - previousTime;
  previousTime = currentTime;

  // Logotype + byline + about
  {
    var yAdjustmentLogoType = 0;
    var yAdjustmentByline = -5;
    var imageScaleFactor = isRetina() ? 0.5 : 1.0;
    image(logotypeImage, grid.margin.left, grid.margin.top + yAdjustmentLogoType, logotypeImage.width * imageScaleFactor, logotypeImage.height * imageScaleFactor);
    if (!bylineDiv) {
      var byline = "Explore the staggering amount of mapped and named peaks in the Swiss Alps. See how the four official languages contributed to the peaks’ names, and how a lesser known language has a surprising reach. Can you discover high peaks, that can be seen from different regions, and hence have multiple names?";
      bylineDiv = createDiv(byline).parent("centerContainer");
      bylineDiv.size(grid.colwidth() + grid.gutter + grid.colwidth(), p5.AUTO);
    }
    bylineDiv.position(grid.margin.left + grid.colwidth() + grid.gutter, grid.margin.top + yAdjustmentByline);
    if (!aboutDiv) {
      var about = "Data from <a href=\"https://shop.swisstopo.admin.ch/en/products/landscape/names3D\" target=\"_blank\">swisstopo</a><br><a data-toggle=\"modal\" href=\"#peaks-about-modal\">About this visualization</a>";
      aboutDiv = createDiv(about).class("about").parent("centerContainer");
      var rightMargin = 60;
      aboutDiv.size(grid.colwidth() - rightMargin, p5.AUTO);
    }
    aboutDiv.position(grid.margin.left + (grid.colwidth() + grid.gutter) * 3, grid.margin.top + yAdjustmentByline);
  }


  // Topo
  // Simplyfing the geometry gives us a block aesthetic that is desired here to not distract from the texture of the peaks.
  // PERFORMANCE: with pre-projecting and this level of simplification (gdal -> topojson [quantization 1e3, simplify-proportion 0.25] this takes ~<5fps.
  {
    noFill();
    stroke(darkColor);
    strokeWeight(2);
    for (var i = 0; i < countryLines.length; i++) {
      var lineSegments = countryLines[i];
      beginShape();
      for (var j = 0; j < lineSegments.length; j+=2) {
        vertex(lineSegments[j], lineSegments[j+1]);
      }
      endShape();
    }
  }


  // Peak Name Language Filter
  {
    strokeWeight(1.5);
    strokeCap(SQUARE);
    var yAdjustment = -9;
    var x = grid.margin.left + (grid.colwidth() + grid.gutter) * 3;
    var y = grid.margin.top + grid.rowheight() * (grid.nrow - 7) + yAdjustment;
    var w = 30;
    var h = 15;
    var xRunning = x;
    var leftMargin = 1;
    var bottomMargin = 6;
    if (!checkboxesForLangs) {
      checkboxesForLangs = {};
      for (var lang in namesForLangs) {
        var name = namesForLangs[lang];
        var div = createDiv(name.toUpperCase()).id(lang).parent("centerContainer");
        div.class("peaks-label clickable rotated noselect");
        div.position(xRunning+w/2+leftMargin, y-h-bottomMargin);
        div["hitRadius"] = max(w, h) / 2;
        div["isChecked"] = true;
        div.mouseClicked(function() {
          toggleCheckbox(this);
        });
        checkboxesForLangs[lang] = div;
        xRunning += w;
      }
    } else {
      for (var lang in checkboxesForLangs) {
        var checkbox = checkboxesForLangs[lang];
        checkbox["center"] = createVector(xRunning+w/2, y-h/2);
        fill(checkbox.isChecked ? keyColors[lang] : disabledColor);
        // checkbox
        stroke(borderColor);
        triangle(xRunning, y, xRunning+w/2, y-h, xRunning+w, y);
        // checkmark
        if (checkbox.isChecked) {
          noFill();
          stroke(foregroundColor);
          beginShape();
          {
            var p1 = createVector(xRunning+13, y-8);
            vertex(p1.x, p1.y);
            var p2 = createVector(xRunning+19, y-8);
            var v = p5.Vector.sub(p2, p1);
            v.rotate(radians(45));
            vertex(p1.x+v.x, p1.y+v.y);
            // Oddly, 90° doesn't look parallel
            v.rotate(radians(-88));
            v.setMag(checkbox.size().width + leftMargin + bottomMargin);
            vertex(p2.x+v.x, p2.y+v.y);
          }
          endShape();
        }
        xRunning += w;
      }
    }
  }


  // Peak Type Filter
  {
    var yAdjustment = -3;
    var x = grid.margin.left + (grid.colwidth() + grid.gutter) * 3;
    var y = grid.margin.top + grid.rowheight() * (grid.nrow - 4) + yAdjustment;
    var w = 50;
    var h = 25;
    var wDecrement = 10;
    var hDecrement = 5;
    var xOffset = 30;
    var leftMargin = 1;
    var bottomMargin = 6;
    if (!checkboxesForTypes) {
      checkboxesForTypes = {};
      var types = Object.keys(namesForTypes).reverse();
      for (var i = 0; i < types.length; i++) {
        var type = types[i];
        var name = namesForTypes[type];
        var div = createDiv(name.toUpperCase()).id(type).parent("centerContainer");
        div.class("peaks-label clickable rotated noselect");
        div.position(x+w/2+leftMargin, y-h-bottomMargin);
        div["hitRadius"] = max(w, h) / 2;
        div["isChecked"] = true;
        div.mouseClicked(function() {
          toggleCheckbox(this);
        });
        checkboxesForTypes[type] = div;
        x += xOffset;
        w -= wDecrement;
        h -= hDecrement;
      }
    } else {
      for (var type in checkboxesForTypes) {
        var checkbox = checkboxesForTypes[type];
        checkbox["center"] = createVector(x+w/2, y-h/2);
        fill(checkbox.isChecked ? typeColors[type] : disabledColor);
        // checkbox
        stroke(borderColor);
        triangle(x, y, x+w/2, y-h, x+w, y);
        // checkmark
        if (checkbox.isChecked) {
          noFill();
          stroke(foregroundColor);
          beginShape();
          {
            var p1 = createVector(x+13, y-8);
            vertex(p1.x, p1.y);
            var p2 = createVector(x+19, y-8);
            var v = p5.Vector.sub(p2, p1);
            v.rotate(radians(45));
            vertex(p1.x+v.x, p1.y+v.y);
            // Oddly, 90° doesn't look parallel
            v.rotate(radians(-88));
            v.setMag(sqrt(pow(w/2 + leftMargin + checkbox.size().width, 2) + pow(h, 2))*0.85);
            vertex(p2.x+v.x, p2.y+v.y);
          }
          endShape();
        }
        x += xOffset;
        w -= wDecrement;
        h -= hDecrement;
      }
    }
  }


  // Peak Altitude Filter
  {
    var yAdjustment = 5;
    var x = grid.margin.left + (grid.colwidth() + grid.gutter) * 3;
    var y = grid.margin.top + grid.rowheight() * (grid.nrow - 2) + yAdjustment;
    var yRunning = y;
    var w = 120;
    var h = 2;
    var knobWidth = 15;
    var knobHeight = 10;
    if (!altitudeControl) {
      // Slight magic knob-related adjustments
      altitudeControl = new RangeControl(x+knobWidth/2, y, w-knobWidth/2, h, knobWidth, knobHeight, data.zMin, data.zMax);
    }
    altitudeControl.display();
    yRunning += knobHeight;

    // SHOW IN FEET toggle
    if (!showInFeetDiv) {
      showInFeetDiv = createDiv().id("showInFeetDiv").parent("centerContainer");
      showInFeetDiv.class("peaks-label clickable underlined noselect");
      showInFeetDiv.mouseClicked(function() {
        shouldShowInFeet = !shouldShowInFeet;
      });
    }
    showInFeetDiv.html(shouldShowInFeet ? "SHOW IN METERS" : "SHOW IN FEET");
    var topMargin = 10;
    showInFeetDiv.position(x + w - showInFeetDiv.size().width + knobWidth/2, yRunning + topMargin);
  }


  // Peaks
  {
    if (cursorPopupDiv) {
      cursorPopupDiv.hide();
    }
    noStroke();
    var diameter = 2;
    // Has to be even (e.g. 4) for ellipse and stroke to perfectly line up
    strokeWeight(diameter);
    var highlightShadowOffset = 1.5;
    var hoverPeaks = [];
    coloredPeaks = [];
    var isHighlighting = false;
    var interactionDistance = 36;
    for (var i = 0; i < data.peaks.length; i++) {
      var peak = data.peaks[i];
      var type = peak.type;
      var x = peak.x;
      var y = peak.y;
      var z = peak.z;

      // Filters: Peak name language, type, altitude, and name
      // A single peak can have names in multiple languages, and even per language multiple names.
      // "name": {
      //   "de": ["name1", "name2"],
      //   "fr": "name3"
      // },
      var checkedLangs = [];
      for (var lang in peak.name) {
        if (checkboxesForLangs[lang].isChecked) {
          checkedLangs.push(lang);
        }
      }
      var shouldColor = (checkedLangs.length > 0);
      shouldColor &= checkboxesForTypes[type].isChecked;
      shouldColor &= (z >= altitudeControl.minValue() && z <= altitudeControl.maxValue());
      if (shouldColor) {
        // Here we simplify a bit and just grab the first language
        var colorLang = colors[checkedLangs[0]];
        var colorIndex = round(map(z, data.zMax, data.zMin, 0, colorLang.length - 1));
        var col = colorLang[colorIndex];
        // Associate value (for mouse interaction and idle animation)
        peak["col"] = col;

        // Highlight specific peaks
        var shouldHighlight = false;
        for (var j = 0; j < highlightedPeaks.length; j++) {
          var highlightedPeak = highlightedPeaks[j];
          if (peak.id === highlightedPeak.id) {
            shouldHighlight = true;
            break;
          }
        }
        if (shouldHighlight) {
          stroke(highlightShadowColor);
          line(x-highlightShadowOffset, y-highlightShadowOffset, x-highlightShadowOffset, y-highlightShadowOffset - peak.length);
          stroke(col);
          line(x, y, x, y - peak.length);
          noStroke();
          isHighlighting = true;
        }

        // Mouse Interaction
        // I investigated bulge effect and it looks cool but it then gets hard to point to a particular peak
        var distance = dist(x, y, mouseX-2, mouseY-6);
        if (distance < interactionDistance) {
          // Associate value (for highlight)
          peak["distance"] = distance;
          hoverPeaks.push(peak);
        }
        coloredPeaks.push(peak);
      } else {
        col = darkColor;
      }
      fill(col);
      // Moving from ellipse to point didn't do anything to performance
      ellipse(x, y, diameter, diameter);
    }
  }

  // To solve the problem of overlapping labels, cycle through popup one by one (use time)
  if (isHighlighting) {
    popupCycleRemaining -= elapsedTime;
    if (popupCycleRemaining <= 0) {
      popupCycleRemaining = popupCycleDelay;
      var highlightedPeaksCurrentPopupIdx = highlightedPeaks.indexOf(highlightedPeakCurrentPopup);
      highlightedPeaksCurrentPopupIdx = (highlightedPeaksCurrentPopupIdx + 1) % highlightedPeaks.length;
      setHighlightedPeakCurrentPopupToFirstColoredPeak(highlightedPeaksCurrentPopupIdx);
    }
    if (highlightedPeakCurrentPopup) {
      displayPopupForPeak(highlightedPeakCurrentPopup);
    }
  }

  // Idle animation
  if (isHighlighting === false && hoverPeaks.length === 0) {
    // Count down
    idleHoverRemaining -= elapsedTime;
    if (idleHoverRemaining <= 0) {
      // Steps of 0.005-0.03 work best for most applications
      var noiseStep = 0.001;
      idleHoverNoiseVector.x += noiseStep;
      idleHoverNoiseVector.y += noiseStep;
      // The resulting value will always be between 0.0 and 1.0.
      var movementPadding = 100;
      var idleHoverX = map(noise(idleHoverNoiseVector.x), 0, 1, peaksPadding.left+movementPadding, width-peaksPadding.right-movementPadding);
      var idleHoverY = map(noise(idleHoverNoiseVector.y), 0, 1, peaksPadding.top+movementPadding, height-peaksPadding.bottom-movementPadding);
      for (var i = 0; i < coloredPeaks.length; i++) {
        var coloredPeak = coloredPeaks[i];
        var distance = dist(coloredPeak.x, coloredPeak.y, idleHoverX, idleHoverY);
        if (distance < interactionDistance) {
          // Associate value (for highlight)
          coloredPeak["distance"] = distance;
          hoverPeaks.push(coloredPeak);
        }
      }
    }
  } else {
    // Reset idle timer
    idleHoverRemaining = idleHoverDelay;
  }

  // Highlight peak closest to mouse
  if (hoverPeaks.length > 0) {
    // First, draw translucent shadow lines for each line
    strokeWeight(diameter * 1.5);
    strokeCap(ROUND);
    hoverPeaks.forEach(function(hoverPeak, index, hoverPeaks) {
      var p1 = createVector(hoverPeak.x, hoverPeak.y);
      var p2 = createVector(hoverPeak.x, hoverPeak.y - hoverPeak.length);
      var v = p5.Vector.sub(p2, p1);
      v.rotate(radians(-45));
      v.mult(1.75);
      stroke(shadowColorsForColors[hoverPeak.col]);
      line(hoverPeak.x, hoverPeak.y, hoverPeak.x+v.x, hoverPeak.y+v.y);
    });

    // Draw "z-line from point origin "up" to show altitude
    strokeWeight(diameter);
    hoverPeaks.forEach(function(hoverPeak, index, hoverPeaks) {
      stroke(hoverColorsForColors[hoverPeak.col]);
      line(hoverPeak.x, hoverPeak.y, hoverPeak.x, hoverPeak.y - hoverPeak.length);
    });

    // Display name closest to mouse
    hoverPeaks.sort(function(a, b) {
      return a.distance - b.distance;
    });
    var closestPeak = hoverPeaks[0];
    stroke(highlightShadowColor);
    line(closestPeak.x-highlightShadowOffset, closestPeak.y-highlightShadowOffset, closestPeak.x-highlightShadowOffset, closestPeak.y-highlightShadowOffset - closestPeak.length);
    stroke(closestPeak.col);
    line(closestPeak.x, closestPeak.y, closestPeak.x, closestPeak.y - closestPeak.length);
    strokeCap(SQUARE);
    displayPopupForPeak(closestPeak);
  }


  var storiesStartRow = grid.nrow - 6;
  var storyTitleYAdjustment = -12;
  var rulerWidth = 1;
  noStroke();
  // Story 1: Language Share of Peak Names
  {
    var x = grid.margin.left;
    var y = grid.margin.top + grid.rowheight() * storiesStartRow;
    var yRunning = y;

    if (!languageShareTitleDiv) {
      languageShareTitleDiv = createDiv("Language Share of Peak Names").parent("centerContainer");
      languageShareTitleDiv.class("storytitle");
      languageShareTitleDiv.size(grid.colwidth(), p5.AUTO);
    }
    languageShareTitleDiv.position(x, y+storyTitleYAdjustment);
    yRunning += grid.rowheight();

    var labelsYAdjustment = 2;
    // NAMES PER LANGUAGE label
    if (!namesPerLanguageDiv) {
      namesPerLanguageDiv = createDiv("NAMES PER LANGUAGE").parent("centerContainer");
      namesPerLanguageDiv.class("peaks-label");
      namesPerLanguageDiv.position(x, yRunning+labelsYAdjustment);
    }
    // SHOW PER SPEAKERS toggle
    if (!showPerSpeakersDiv) {
      showPerSpeakersDiv = createDiv().id("showPerSpeakersDiv").parent("centerContainer");
      showPerSpeakersDiv.class("peaks-label clickable underlined noselect");
      showPerSpeakersDiv.mouseClicked(function() {
        shouldShowPerSpeakers = !shouldShowPerSpeakers;
        // Reset idle timer
        idleHoverRemaining = idleHoverDelay;
      });
    }
    showPerSpeakersDiv.html(shouldShowPerSpeakers ? "SHOW ABSOLUTE" : "SHOW PER SPEAKERS");
    showPerSpeakersDiv.position(x + grid.colwidth() - showPerSpeakersDiv.size().width, yRunning+labelsYAdjustment);
    yRunning += grid.rowheight();

    // Create divs with content
    var langCounts = data.langCounts.slice(0);
    if (languagesDivs.length === 0) {
      for (var i = 0; i < langCounts.length; i++) {
        var langCount = langCounts[i];
        var lang = Object.keys(langCount)[0];
        var count = langCount[lang];
        var langName = namesForLangs[lang];
        var speakerCount = speakersForLangs[lang];
        var div = createDiv("<b>" + namesForLangs[lang] + "</b>").parent("centerContainer");
        var langCountSpan = createSpan("&nbsp;&nbsp;&nbsp;" + Number(count).toLocaleString());
        langCountSpan.parent(div);
        // Remember langCountSpan as property for easy access, couldn't make select() to work
        div["langCountSpan"] = langCountSpan;
        createSpan(Number(speakerCount).toLocaleString()).class("number safari_only_number").parent(div);
        div.size(grid.colwidth(), grid.rowheight());
        // Remember count and speakerCount for sorting and bar scaling
        div["count"] = count;
        div["speakerCount"] = speakerCount;
        // Remember lang for bar coloring
        div["lang"] = lang;
        languagesDivs.push(div);
      }
    }
    // Sort divs
    languagesDivs.sort(function(a, b) {
      if (shouldShowPerSpeakers) {
        return (b.count / b.speakerCount) - (a.count / a.speakerCount);
      } else {
        return b.count - a.count;
      }
    });
    // Lay divs out, update content, and render bar
    var barWidthMax = grid.colwidth() / 2;
    var barHeight = 3;
    var firstCount = languagesDivs[0].count;
    if (shouldShowPerSpeakers) {
      firstCount /= languagesDivs[0].speakerCount;
    }
    for (var i = 0; i < languagesDivs.length; i++) {
      var animating = false;
      var div = languagesDivs[i];
      // Pretty lame way of animating, but it does the job.
      var yStep = 6;
      var yCurrent = div.position().y;
      var yTarget = round(yRunning);
      var y = yCurrent;
      var yDiff = yCurrent - yTarget;
      // The height-check avoids animating in the very first loop
      if (yCurrent !== height && abs(yDiff) >= yStep) {
        // We have animation to do
        y = yCurrent + (yDiff > 0 ? -yStep : yStep);
        div["animating"] = true;
      } else {
        y = yTarget;
        div["animating"] = false;
      }
      div.position(x, y);

      // Do this once animation is over, not right away
      if (!div.animating) {
        if (shouldShowPerSpeakers) {
          div.langCountSpan.hide();
        } else {
          // show() does "block", but we want "inline"
          div.langCountSpan.style("display", "inline");
        }
      }

      // Bar
      var count = div.count;
      if (shouldShowPerSpeakers) {
        count /= div.speakerCount;
      }
      var barWidth = map(count, 0, firstCount, 0, barWidthMax);
      var topMargin = 18;
      fill(darkColor);
      rect(x, y+topMargin, barWidthMax, barHeight);
      fill(keyColors[div.lang]);
      rect(x, y+topMargin, barWidth, barHeight);

      yRunning += grid.rowheight();
    }
  }


  // Story 2: Most Common Peak Names
  {
    var x = grid.margin.left + (grid.colwidth() + grid.gutter) * 1;
    var y = grid.margin.top + grid.rowheight() * storiesStartRow;
    var yRunning = y;

    if (!topNamesTitleDiv) {
      topNamesTitleDiv = createDiv("Most Common Peak Names").parent("centerContainer");
      topNamesTitleDiv.class("storytitle");
      topNamesTitleDiv.size(grid.colwidth(), p5.AUTO);
    }
    topNamesTitleDiv.position(x, y+storyTitleYAdjustment);
    yRunning += grid.rowheight();

    if (topNamesDivs.length === 0) {
      for (var i = 0; i < data.topNames.length; i++) {
        var nameCount = data.topNames[i];
        var name = Object.keys(nameCount)[0];
        var count = nameCount[name];
        var div = createDiv("<b>" + name + "</b>&nbsp;&nbsp;&nbsp;" + count).id(name).parent("centerContainer");
        // Needs a position so size().width is set
        div.position(0, 0);
        div.class("hoverable");
        div.mouseOver(function() {
          highlightedPeaks = peaksMatchingName(this.id());
          updateHighlightedPeakCurrentPopup();
        });
        div.mouseOut(function() {
          highlightedPeaks = [];
        });
        topNamesDivs.push(div);
        if (i >= floor(data.topNames.length / 2)) {
          secondColWidthMax = max(secondColWidthMax, div.size().width);
        }
      }
    }
    var xRunning = x;
    for (var i = 0; i < topNamesDivs.length; i++) {
      // Second col
      if (i === floor(topNamesDivs.length / 2)) {
        xRunning += grid.colwidth() - secondColWidthMax;
        yRunning = y + grid.rowheight();
      }
      var div = topNamesDivs[i];
      div.position(xRunning, yRunning);
      yRunning += grid.rowheight();
    }
  }


  // Story 3:
  {
    var x = grid.margin.left + (grid.colwidth() + grid.gutter) * 2;
    var y = grid.margin.top + grid.rowheight() * storiesStartRow;
    var yRunning = y;

    if (!nameOriginTitleDiv) {
      nameOriginTitleDiv = createDiv("Horns, Teeth, and Pyramids").parent("centerContainer");
      nameOriginTitleDiv.class("storytitle");
      nameOriginTitleDiv.size(grid.colwidth(), p5.AUTO);
    }
    nameOriginTitleDiv.position(x, y+storyTitleYAdjustment);
    yRunning += grid.rowheight();

    if (!nameOriginTextDiv) {
      nameOriginTextDiv = createDiv("").parent("centerContainer");
      nameOriginTextDiv.class("originstory");
      nameOriginTextDiv.size(grid.colwidth(), p5.AUTO);

      // Color tags
      var spanForColorName = {};
      for (var colorName in aliasesForColorNames) {
        var span = createSpan(colorName).id(colorName).parent("centerContainer");
        span.class("tag hoverable");
        span.mouseOver(function() {
          highlightedPeaks.push.apply(highlightedPeaks, peaksContainingStrings(aliasesForColorNames[this.id()]));
          updateHighlightedPeakCurrentPopup();
        });
        span.mouseOut(function() {
          highlightedPeaks = [];
        });
        spanForColorName[colorName] = span;
      }

      createSpan("Mountain names often refer to their appearance in shape combined with themes like weather, time of day, or color. Common colors are ").parent(nameOriginTextDiv);
      spanForColorName["white"].parent(nameOriginTextDiv);
      createSpan(" for snow, ").parent(nameOriginTextDiv);
      spanForColorName["red"].parent(nameOriginTextDiv);
      createSpan(" for the sun at dawn or dusk, and ").parent(nameOriginTextDiv);
      spanForColorName["black"].parent(nameOriginTextDiv);
      createSpan(" for dark forest or rock.").parent(nameOriginTextDiv);
    }
    nameOriginTextDiv.position(x, yRunning);
  }
}

/*
 * Cursor popup
 */
function displayPopupForPeak(peak) {
  var displayNames = [];
  var peakNameLangs = Object.keys(peak.name);
  for (var i = 0; i < peakNameLangs.length; i++) {
    var lang = peakNameLangs[i];
    var names = peak.name[lang];
    if (Array.isArray(names)) {
      // We know there's only ever 2 names in the same language and so simplify a bit here (there's 7 such peaks btw.)
      var name = names[0] + "&nbsp;(" + names[1] + ")";
      displayNames.push("<b>" + name + "</b>");
    } else {
      var name = names;
      if (peakNameLangs.length > 1) {
        name = name + "&nbsp;<span style=\"color: " + keyColors[lang] + "; vertical-align: middle;\">•</span>";
      }
      displayNames.push("<b>" + name + "</b>");
    }
  }
  displayNames[0] += "&nbsp;&nbsp;&nbsp;" + round(shouldShowInFeet ? peak.z / metersPerFoot : peak.z).toLocaleString() + altitudeUnitString();
  if (!cursorPopupDiv) {
    cursorPopupDiv = createDiv().parent("centerContainer");
    cursorPopupDiv.class("cursorpopup noselect");
  }
  cursorPopupDiv.show();
  cursorPopupDiv.html(displayNames.join("<br>"));
  var bottomMargin = 22 + (peakNameLangs.length - 1) * 8;
  cursorPopupDiv.position(peak.x, peak.y - peak.length - bottomMargin);
}


/*
 * Altitude Slider
 */
function RangeControl(x, y, w, h, knobWidth, knobHeight, min, max) {
  this.x = x;
  this.y = y;
  this.w = w;
  this.h = h;
  this.min = min;
  this.max = max;
  this.knobMin = new Knob(x+w, y+h, knobWidth, knobHeight, foregroundColor);
  this.knobMax = new Knob(x, y+h, knobWidth, knobHeight, foregroundColor);
  this.minTextDiv = createDiv().class("altitude rotated noselect").parent("centerContainer");
  this.maxTextDiv = createDiv().class("altitude rotated noselect").parent("centerContainer");
  this.display = function() {
    // background line
    noFill();
    stroke(darkColor);
    strokeWeight(h);
    strokeCap(SQUARE);
    line(x, y+h/2, x+w, y+h/2);
    // highlight line
    stroke(foregroundColor);
    line(this.knobMax.x, y+h/2, this.knobMin.x, y+h/2);
    // knobs
    this.knobMin.display();
    this.knobMax.display();
    // text
    this.minTextDiv.html(round(shouldShowInFeet ? this.minValue() / metersPerFoot : this.minValue()).toLocaleString() + altitudeUnitString());
    this.maxTextDiv.html(round(shouldShowInFeet ? this.maxValue() / metersPerFoot : this.maxValue()).toLocaleString() + altitudeUnitString());
    var xNudge = 6;
    var bottomMargin = 14;
    this.minTextDiv.position(this.knobMin.x - xNudge, this.knobMin.y - bottomMargin);
    this.maxTextDiv.position(this.knobMax.x - xNudge, this.knobMax.y - bottomMargin);
  };
  this.update = function() {
    // Follow mouse, constrain, space out
    if (this.knobMin.isOn) {
      this.knobMin.x = constrain(mouseX, this.knobMax.x + this.knobMax.w/2, this.knobMin.xInitial);
    }
    if (this.knobMax.isOn) {
      this.knobMax.x = constrain(mouseX, this.knobMax.xInitial, this.knobMin.x - this.knobMin.w/2);
    }
  };
  this.minValue = function() {
    return map(this.knobMin.x, this.knobMin.xInitial, this.knobMax.xInitial, this.min, this.max);
  };
  this.maxValue = function() {
    return map(this.knobMax.x, this.knobMax.xInitial, this.knobMin.xInitial, this.max, this.min);
  };
}

function Knob(x, y, w, h) {
  // x and y are the coordinates of the tip
  this.x = x;
  this.y = y;
  this.w = w;
  this.h = h;
  this.xInitial = x;
  this.isOn = false;
  this.display = function() {
    fill(this.isOn ? pressedColor : foregroundColor);
    stroke(borderColor);
    strokeWeight(1.5);
    triangle(this.x, this.y, this.x+w/2, this.y+this.h, this.x-w/2, this.y+this.h);
  };
  this.isClicked = function() {
    return dist(this.x+w/2, this.y+this.h/2, mouseX, mouseY) < max(this.w, this.h);
  };
}


/*
 * Mouse Events
 */
function mousePressed() {
  if (altitudeControl.knobMin.isClicked()) {
    altitudeControl.knobMin.isOn = true;
  } else if (altitudeControl.knobMax.isClicked()) {
    altitudeControl.knobMax.isOn = true;
  }
}

function mouseDragged() {
  altitudeControl.update();
}

function mouseReleased() {
  altitudeControl.knobMin.isOn = false;
  altitudeControl.knobMax.isOn = false;
}

function mouseClicked() {
  for (var lang in checkboxesForLangs) {
    var checkbox = checkboxesForLangs[lang];
    if (dist(checkbox.center.x, checkbox.center.y, mouseX, mouseY) < checkbox.hitRadius) {
      toggleCheckbox(checkbox);
      break;
    }
  }
  var types = Object.keys(checkboxesForTypes).reverse();
  for (var i = 0; i < types.length; i++) {
    var type = types[i];
    var checkbox = checkboxesForTypes[type];
    if (dist(checkbox.center.x, checkbox.center.y, mouseX, mouseY) < checkbox.hitRadius) {
      toggleCheckbox(checkbox);
      break;
    }
  }
}


/*
 * Helper Functions
 */

function mapCoordX(e) {
  return map(e, data.eMin, data.eMax, peaksPadding.left, width - peaksPadding.right);
}

function mapCoordY(n) {
  return map(n, data.nMax, data.nMin, peaksPadding.top, height - peaksPadding.bottom);
}

function altitudeUnitString() {
  return shouldShowInFeet ? "&nbsp;ft" : "&nbsp;m";
}

function replaceSpacesWithNonBreaking(string) {
  return string.replace(/ /g, "&nbsp;");
}

function toggleCheckbox(checkbox) {
  if (checkbox.isChecked) {
    checkbox.isChecked = false;
    checkbox.addClass("underlined");
  } else {
    checkbox.isChecked = true;
    checkbox.removeClass("underlined");
  }
}

function peaksMatchingName(matchName) {
  var matches = [];
  for (var i = 0; i < data.peaks.length; i++) {
    var peak = data.peaks[i];
    var langs = Object.keys(peak.name);
    for (var j = 0; j < langs.length; j++) {
      var lang = langs[j];
      var names = peak.name[lang];
      if (Array.isArray(names)) {
        for (var k = 0; k < names.length; k++) {
          var name = names[k];
          if (name === matchName) {
            matches.push(peak);
          }
        }
      } else {
        var name = names;
        if (name === matchName) {
          matches.push(peak);
        }
      }
    }
  }
  return matches;
}

function peaksContainingStrings(matchStrings) {
  var matches = [];
  for (var i = 0; i < data.peaks.length; i++) {
    var peak = data.peaks[i];
    var langs = Object.keys(peak.name);
    for (var j = 0; j < langs.length; j++) {
      var lang = langs[j];
      var names = peak.name[lang];
      if (Array.isArray(names)) {
        for (var k = 0; k < names.length; k++) {
          var name = names[k];
          if (nameContainsMatchStrings(name, matchStrings)) {
            matches.push(peak);
          }
        }
      } else {
        var name = names;
        if (nameContainsMatchStrings(name, matchStrings)) {
          matches.push(peak);
        }
      }
    }
  }
  return matches;
}

function nameContainsMatchStrings(name, matchStrings) {
  // Bail for some bad string matches (exclusions)
  if (name === "Grotzligütsch" ||
      name === "Piz&nbsp;Rots" ||
      name === "Parrotspitze" || name === "Punta&nbsp;Parrot" ||
      name === "Piz&nbsp;dil&nbsp;Crot" ||
      name === "Pizzo&nbsp;Crotto") {
    return false;
  }
  return matchStrings.some(function(matchString, index, matchStrings) {
    // Case-insensitive "contains" string matching
    return (this.toLowerCase().indexOf(matchString) !== -1);
  }, name);
}

function updateHighlightedPeakCurrentPopup() {
  popupCycleRemaining = popupCycleDelay;
  // If we don't have a last one yet, or we switched highlight set, start from beginning.
  // Otherwise we lave as is and it will pick back up where it left off.
  if (highlightedPeaks.length > 0) {
    if (!highlightedPeakCurrentPopup) {
      setHighlightedPeakCurrentPopupToFirstColoredPeak(0);
    } else {
      var containsLastPopupPeak = false;
      for (var i = 0; i < highlightedPeaks.length; i++) {
        var highlightedPeak = highlightedPeaks[i];
        if (highlightedPeak.id === highlightedPeakCurrentPopup.id) {
          containsLastPopupPeak = true;
          break;
        }
      }
      if (containsLastPopupPeak === false) {
        setHighlightedPeakCurrentPopupToFirstColoredPeak(0);
      }
    }
  }
}

function setHighlightedPeakCurrentPopupToFirstColoredPeak(startIdx) {
  for (var i = 0; i < highlightedPeaks.length; i++) {
    var tryIdx = (startIdx + i) % highlightedPeaks.length;
    var highlightedPeak = highlightedPeaks[tryIdx];
    if (coloredPeaks.indexOf(highlightedPeak) !== -1) {
      highlightedPeakCurrentPopup = highlightedPeak;
      break;
    }
  }
}

function isRetina() {
  return (displayDensity() > 1);
}


/*
 * Defining Data
 */

// The paddings are with respect to the peaks, not the topo.
var peaksPadding = {
  "left": 45,
  "right": 87,
  "top": 113,
  "bottom": 187
};

var namesForLangs = {
  "de": "German",
  "fr": "French",
  "it": "Italian",
  "rm": "Romansh"
};

var speakersForLangs = {
  "de": 5092279,
  "fr": 1822187,
  "it": 655236,
  "rm": 42410
};

var namesForTypes = {
  "regular": "Regular",
  "main": "Primary",
  "alpine": "Alpine"
};

var metersPerFoot = 0.3048;

// 4x "qualitatively" (eye-balled) different single-hue sequences of seven (light..dark)
// Colors from http://colorbrewer2.org are a good starting point, but needed some tweaking (e.g. tone down orange).
// de=blue, fr=green, it=orange, rm=purple
var colorHexesForLangs = {
  "de": ["#E1EDF7", "#C9DDF0", "#9ECAE1", "#6BAED6", "#4292C6", "#1D6EB5", "#06519C"],
  "fr": ["#E5F5E0", "#CDEBC7", "#A4D99E", "#76C478", "#42AD5F", "#248F47", "#006E2C"],
  "it": ["#FFF0E0", "#FCDFC2", "#FAC698", "#F0A169", "#E68C55", "#CF7342", "#A8552C"],
  "rm": ["#EDE9F5", "#DDDAED", "#C1BDDE", "#A29BC9", "#8379BA", "#6950A3", "#5C3391"]
};

var colorHexesForTypes = {
  "regular": "#3D3C3A",
  "main": "#474745",
  "alpine": "#545351"
};

var aliasesForColorNames = {
  "white": ["wiss", "weiss", "wyss", "blanc", "bianco", "bianca", "alv"],
  "red": ["rot", "rouge", "rosso", "cotschen", "cotschna"],
  "black": ["schwarz", "noir", "nero", "nair"]
};
// See nameContainsMatchStrings() for a list of exclusions


/*
 * Loading External Data
 */

function preload() {
  // Even though the doc says loadJSON guarantees to load sync in preload, I found I needed to use the callback variant.
  // Another known issue is that the error callback doesn't seem to ever get called, even if JSON is malformed.

  // Data
  loadJSON(dataFilepath, function(obj) {
    data = obj;
    // print("Successfully loaded " + dataFilepath);
  }, function(error) {
    print("Error loading " + dataFilepath + ": " + error);
  });

  // Topo
  loadJSON(topoFilepath, function(obj) {
    topo = obj;
    // print("Successfully loaded " + topoFilepath);
  }, function(error) {
    print("Error loading " + topoFilePath + ": " + error);
  });

  // Logotype image
  var imageName = isRetina() ? "images/peaks-logotype@2x.png" : "images/peaks-logotype.png";
  logotypeImage = loadImage(imageName);
}


/*
 * DEBUG Key Events
 */
/*
function keyReleased() {
  // DEBUG action
  if (key == "d" || key == "D") {
    print("DEBUG action");
  }
  // DEBUG Loop start-/stopping
  else if (key == "l" || key == "L") {
    if (isLooping) {
      noLoop();
    } else {
      loop();
    }
    isLooping = !isLooping;
  }
  // Screen Recording
  else if (key == "s" || key == "S") {
    // [s]creenshot -- will get prompted by browser to download
    saveCanvas("screenshot@2x", "png");
    // There is also `save()`, which simply calls `saveCanvas()` under the hood for images
  } else if (key == "m" || key == "M") {
    // [m]ovie -- auto-downloading multiple files works in Chrome but not in Safari
    var filename = "frame"; // will be suffixed (before extension but after e.g. '@2x'-part) with a zero-based index w/o leading zeros; can't auto-create a folder a la adding 'output/' to path
    var extension = "png"; // 'gif' will still save out as PNG merely with the .gif suffix
    var duration = 8; // in seconds
    var fps = 30;
    var callback = function(frames) { // single argument in callback is frames array with frame objs
      // Here I could convert frames to animated GIF ...
      for (var i = 0; i < frames.length; i++) {
        var frame = frames[i];
        print(frame.ext);
        print(frame.filename);
        print(frame.imageData) // "data:image/octet-stream;base64,iVBORw…"
      }
    };
    callback = null;
    saveFrames(filename, extension, duration, fps, callback);
  }
}
*/
