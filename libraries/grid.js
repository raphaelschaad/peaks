function Grid(mt, mb, ml, mr,
  nc, g, nr) {

  this.color = color(238, 130, 238),

    this.margin = {
      top: mt, // px
      bottom: mb, // px
      left: ml, // px
      right: mr // px
    },

    this.ncol = nc,
    this.gutter = g, // px
    this.nrow = nr,

    this.colwidth = function() {
      return (width - this.margin.left - this.margin.right -
        (this.ncol - 1) * this.gutter) / this.ncol;
    },

    this.colheight = function() {
      return (height - this.margin.top - this.margin.bottom);
    },

    this.rowheight = function() {
      return (this.colheight()) / this.nrow;
    },

    this.isvisible = true,
    this.marginvisible = true,
    this.rowvisible = true,
    this.colvisible = true,
    this.crossvisible = true;

  this.togglevisibility = function() {
    if (this.marginvisible && this.rowvisible &&
        this.colvisible && this.crossvisible) {
      this.isvisible = true;
    }
    else if (!this.marginvisible && !this.rowvisible &&
             !this.colvisible && !this.crossvisible) {
      this.isvisible = false;
    }
    this.isvisible = !this.isvisible;
    this.marginvisible = this.isvisible;
    this.rowvisible = this.isvisible,
    this.colvisible = this.isvisible,
    this.crossvisible = this.isvisible;
  }

  this.display = function() {
      push();

      // columns
      if (this.colvisible) {
        fill(this.color);
        noStroke();
        rectMode(CORNER);
        for (var i = 1; i < this.ncol; i++) {
          rect(this.margin.left + i * this.colwidth() + (i - 1) * this.gutter,
            this.margin.top,
            this.gutter,
            this.colheight());
        }
      }

      // rows
      if (this.rowvisible) {
        noFill();
        stroke(this.color);
        strokeWeight(1);
        for (var i = 1; i < this.nrow; i++) {
          var lineheight = this.margin.top + i * this.rowheight();
          line(this.margin.left, lineheight,
            width - this.margin.right, lineheight);
        }
      }

      // margin
      if (this.marginvisible) {
        noFill();
        stroke(this.color);
        strokeWeight(1);
        rectMode(CORNERS);
        rect(this.margin.top,
          this.margin.left,
          width - this.margin.right,
          height - this.margin.bottom);
      }

      // crosshairs
      if (this.crossvisible) {
        noFill();
        stroke(this.color);
        strokeWeight(2);
        line(0, mouseY, width, mouseY);
        line(mouseX, 0, mouseX, height);

        // tooltip
        noStroke();
        fill(this.color);
        text(mouseX + " x, " + mouseY + " y", mouseX + 10, mouseY - 10);
      }

      pop();

      this.help.display();

  }

  this.help = {
    text: "G toggles grid,\nT toggles crosshairs,\n" +
      "C toggles columns,\nR toggles rows,\n" +
      "SPACE BAR toggles this message",
    isvisible: true,

    display: function() {
      if (this.isvisible) {
        push();
        noStroke();
        fill(0);
        textAlign(LEFT, TOP);
        textSize(15);
        text(this.text, grid.margin.left, grid.margin.top);
        pop();
      }
    }
  }
};

function keyPressed() {
  if (key == 'g' || key == 'G') {
    grid.togglevisibility();
  } else if (key == 'c' || key == 'C') {
    grid.colvisible = !grid.colvisible;
  } else if (key == 'r' || key == 'R') {
    grid.rowvisible = !grid.rowvisible;
  } else if (key == 'm' || key == 'M') {
    grid.marginvisible = !grid.marginvisible;
  } else if (key == 't' || key == 'T') {
    grid.crossvisible = !grid.crossvisible;
  } else if (key == ' ') {
    grid.help.isvisible = !grid.help.isvisible;
  }
};
