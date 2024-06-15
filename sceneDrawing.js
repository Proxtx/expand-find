class CanvasDrawing {
  constructor(canvas, toolbar) {
    this.canvas = canvas;
    this.toolbar = toolbar;
    this.canvas.width = "400";
    this.canvas.height = "400";
    this.ctx = this.canvas.getContext("2d", { willReadFrequently: true });
    this.canvas.addEventListener(
      "mousedown",
      ((e) => {
        this.mouseDown = true;
        this.useTool(this.getPosition(e), true);
      }).bind(this)
    );

    this.canvas.addEventListener(
      "mousemove",
      ((e) => {
        if (this.mouseDown) this.useTool(this.getPosition(e));
      }).bind(this)
    );

    window.addEventListener(
      "mouseup",
      ((e) => {
        this.mouseDown = false;
      }).bind(this)
    );

    console.log(this);
  }

  //determine which tool to use
  useTool(pos, init = false) {
    if (this.toolbar.tool == "draw" || this.toolbar.tool == "eraser") {
      //init the path if this is the first run
      if (init) {
        this.ctx.beginPath();
      }
      this.draw(pos, this.toolbar.color);
    } else if (this.mouseDown) this.fill(pos, this.toolbar.color);
  }

  //get local canvas position from event
  getPosition(e) {
    let rect = this.canvas.getBoundingClientRect();
    return [e.pageX - rect.x, Math.floor(e.pageY - rect.y)];
  }

  //pencil tool
  draw(pos, color) {
    this.ctx.save();
    if (this.mouseDown) this.ctx.lineTo(pos[0], pos[1]);
    /*this.ctx.strokeStyle =
      this.toolbar.tool == "draw" ? color : "rgba(0,0,0,0)";
    */
    this.ctx.strokeStyle = color;
    if (this.toolbar.tool == "eraser") {
      this.ctx.lineWidth = 15;
      this.ctx.globalCompositeOperation = "destination-out";
      this.ctx.stroke();
    } else {
      this.ctx.lineWidth = 5;
      this.ctx.stroke();
    }
    this.ctx.restore();
  }

  //save the canvas content to localStorage in cvs
  saveCVSToStorage() {
    localStorage.cvs = this.canvas.toDataURL();
  }

  //load the value from saveCVSToStorage
  async loadCVSFromStorage() {
    let img = new Image();
    img.src = localStorage.cvs;
    await new Promise((r) => (img.onload = r));
    this.ctx.drawImage(img, 0, 0, this.canvas.width, this.canvas.height);
  }

  //wrapper for the expandFill method
  fill(pos, color) {
    //get the color that is supposed to be filled
    let targetColor = this.ctx.getImageData(pos[0], pos[1], 1, 1).data;

    //get the color that we are filling with as [r, g, b, a]
    this.ctx.fillStyle = color;
    this.ctx.fillRect(pos[0], pos[1], 1, 1);
    let fillColor = this.ctx.getImageData(pos[0], pos[1], 1, 1).data;

    //if the target color is equal the fill color we return since the are is already filled
    if (this.compareImageDataColors(targetColor, fillColor)) return;

    //load the current canvas. This method is faster since we don't need repeated calls to the canvas api and don't need to update the ui mid draw
    let imageData = this.ctx.getImageData(
      0,
      0,
      this.canvas.width,
      this.canvas.height
    );

    //call the expand fill method with:
    //1. the current image
    //2. the position the call originated from
    //3. iteration 0 since we are only one point big
    //4. the current segment is not [0, 0] since that would indicate that we only want to walk in one direction. This indicates that we want wo traverse the entire length of our square which in this case is 1
    //5. obv
    //6. obv
    this.expandFill(imageData, pos, 0, [[1, 0]], 1, fillColor, targetColor);

    //put back the modified canvas
    this.ctx.putImageData(imageData, 0, 0);
    console.log(window.pixelMatchingOperations);
  }

  // this is the main function. To understand how it works ask nicolas.
  // imagePos - Obvious
  // startPos - Obvious
  // iteration - the last iteration
  // segments - the segments in the last iteration. An array of arrays defined as [startOfSegment, endOfSegment]
  // direction - direction in which the next iteration step should develop: 1 bigger -1 smaller
  // fillColor - color that should be filled in
  // targetColor - color that the user originally clicked on
  expandFill(
    imageData,
    startPos,
    iteration,
    segments,
    direction,
    fillColor,
    targetColor
  ) {
    //we can safely return here since we are developing to the 0 circle which is only one dot. Developing any further does not make any sense and since we start at that circle all segments there must have already been discovered
    if (iteration == 1 && direction == -1) {
      return;
    }

    //the next iteration of resultingSegments
    let nextIteration = iteration + direction;
    //the amount of pixels (/max index) of the next iteration
    let nextIterationSize = nextIteration * 8;

    //step 1 convert the segments from last iteration to segments from the current iteration
    for (let segment of segments) {
      segment[0] = this.developPixel(iteration, segment[0], direction);
      segment[1] = this.developPixel(iteration, segment[1], direction);
    }

    //step 2 iterate through the segments. Check if you can continue the segment to any of the sides. If yes save it as an inverted expand fill
    let resultingSegments = []; //segments that should develop in the same direction as we are
    let inverseSegments = []; //segments that should develop in the opposite direction as we are
    // example graphic:
    // -aaaaaaaabbbbbbbbccccccccccc-
    // ---   ---bbbbbbbb---      ---
    // we are developing from lover row to the upper row. From the lower b's we can reach the upper b's so the next iteration of expandFill will be called from the left most upper b to the right most upper b
    // this iteration discovers that there is more space to the left so it expands as far as possible (a). Since the space below a is unknown it is necessary to explore it. For that reason the a's will be pushed as a inverseSegment that are supposed to traverse in the opposite direction
    // same goes for the c's

    for (let segmentIndex in segments) {
      //iterate over the possible segments
      let newNextSegments = []; //these will be the segments that exist in the nextIteration that are reachable from our current segment
      let segment = segments[segmentIndex]; //our current segment

      //if the segment before us stopped at our start we need to continue the segment that the segment before us started
      let lastResultingSegment =
        resultingSegments.length > 0
          ? resultingSegments[resultingSegments.length - 1]
          : null;

      //we are supposed to continue the segment if it is still open (only has a start)
      let continueLastSegment =
        lastResultingSegment && lastResultingSegment.length == 1;

      let currentSegment = null;

      //so if we are supposed to continue it we remove it from the already resulting elements to locally edit it and push it back later
      if (continueLastSegment) {
        resultingSegments.pop();
        currentSegment = lastResultingSegment;
      }

      let currentIndex = segment[0];

      let clockwiseReverseSegmentSize = -1; //this keeps track of how far we have wandered from the original start. We are supposed to invert this segment. This basically represents the c's

      //continue this segment clockwise until we maybe stumble onto the next original segment
      do {
        //this is a while do since we want to traverse around our current square even if our starting pixel is equal to our ending pixel

        let pixelIsFillable =
          this.pixelIndexInsideBounds(startPos, nextIteration, currentIndex) &&
          this.compareImageDataColors(
            this.getImageDataPixelIndex(
              imageData,
              startPos,
              nextIteration,
              currentIndex
            ),
            targetColor
          ); //this is true if the pixel we are looking at is in-bounds and has our target color

        //if the pixel is fillable we fill it.
        //also if we currently have no running segment we open one
        //if we have an open segment this is just in between the start and the end so we don't need to do anything
        if (pixelIsFillable) {
          // if that is the case fill the pixel
          this.setImageDataPixelIndex(
            imageData,
            startPos,
            nextIteration,
            currentIndex,
            clockwiseReverseSegmentSize < 0
              ? fillColor
              : false
              ? [0, 255, 0, 255]
              : fillColor
          );
          //and potentially start a new segment. Unless we already have a start
          if (currentSegment == null) {
            currentSegment = [currentIndex];
          }

          //if we pass our end start counting the distance we travel from it to later spawn an inverted expandFill (c's)
          if (currentIndex == segment[1]) {
            clockwiseReverseSegmentSize = 0;
          } else if (clockwiseReverseSegmentSize > -1) {
            //if we already passed it increase the distance by one
            clockwiseReverseSegmentSize++;
          }
        } else {
          //don't fill the pixel but if we are currently operating on a segment close it since we were unable to continue it
          if (currentSegment && currentSegment.length == 1) {
            currentSegment.push(mod(currentIndex - 1, nextIterationSize));
            newNextSegments.push(currentSegment);
            currentSegment = null;
          }
          // if we are passed out end break since we can't reach any further pixels
          if (currentIndex == segment[1] || clockwiseReverseSegmentSize > -1) {
            break;
          }
        }

        //increase our current index. We need to mod this operation in case we made a full roundtrip
        currentIndex = mod(currentIndex + 1, nextIterationSize);
      } while (
        currentIndex != segments[(segmentIndex + 1) % segments.length][0]
      ); //we continue this loop until the next segment starts. In that case we leave our currentSegment open and rely on the next segment to continue the open segment

      //if we moved past our end we need to create an inverted expandFill
      if (clockwiseReverseSegmentSize > 0) {
        //the start of that inverted fill is our end + 1 since that has already been reached. The end is how far we have gotten
        let reverseSegmentStart = mod(
          currentIndex - (clockwiseReverseSegmentSize + 1),
          nextIterationSize
        );
        inverseSegments.push([reverseSegmentStart, currentIndex]);
      }

      //now we try to discover the a's

      //our first step would be one left of start
      let currentBacktrackAntiClockWiseStep = mod(
        segment[0] - 1,
        nextIterationSize
      );

      //if start could not be reached we are unable to reach any elements left of it
      let anticlockwiseFillEnabled =
        newNextSegments.length > 0 && newNextSegments[0][0] == segment[0];

      // this backtracks anticlockwise. "To the left"
      // this counts how far we have backtracked to later create an inverted segment
      let backtrackSize;

      // this loop executes when:
      //1. we are not continuing the last segment if we are the previous segment already discovered all the space to the left of us
      //2. our current pixel is inside the canvas bounds
      //3. if the start of our anticlockwise movement is even reachable
      //4. our current backtrack step is not the end of the segment before us. This realistically can only happen if we are the first segment and while backtracking hit the last segment
      //5. the color of our current backtrack step is the target color
      for (
        backtrackSize = 0;
        !continueLastSegment &&
        this.pixelIndexInsideBounds(
          startPos,
          nextIteration,
          currentBacktrackAntiClockWiseStep
        ) &&
        anticlockwiseFillEnabled &&
        currentBacktrackAntiClockWiseStep !=
          segments[mod(segmentIndex - 1, segments.length)][1] &&
        this.compareImageDataColors(
          this.getImageDataPixelIndex(
            imageData,
            startPos,
            nextIteration,
            currentBacktrackAntiClockWiseStep
          ),
          targetColor
        );
        backtrackSize++
      ) {
        //we can set the pixel color to our fill color (or debug color)
        this.setImageDataPixelIndex(
          imageData,
          startPos,
          nextIteration,
          currentBacktrackAntiClockWiseStep,
          false ? [0, 0, 255, 255] : fillColor
        );

        //and backtrack further. Mod is necessary since we possibly made a roundtrip
        currentBacktrackAntiClockWiseStep = mod(
          currentBacktrackAntiClockWiseStep - 1,
          nextIterationSize
        );
      }

      // technically this is needed but it worsened things??
      // the last step did not work thats why we need to increase out step again
      /*currentBacktrackAntiClockWiseStep = mod(
        currentBacktrackAntiClockWiseStep + 1,
        nextIterationSize
      );*/

      //push the current segment. It should always be closed unless we hit the start of the next segment in that case we can leave it open and let the next segment continue it
      currentSegment && newNextSegments.push(currentSegment);

      // we made a step-back big enough to spawn an inverse segment later
      if (backtrackSize > 0) {
        //push the inverse segment
        inverseSegments.push([
          currentBacktrackAntiClockWiseStep,
          mod(segment[0] - 1, nextIterationSize),
        ]);
        //and expand the size of segment in the expandFill in our direction to the new leftmost edge
        //this if is supposed to check if we even found any segments in the step above but i think we don't need it anymore
        if (newNextSegments.length > 0)
          newNextSegments[0][0] = currentBacktrackAntiClockWiseStep;
        else newNextSegments = [currentBacktrackAntiClockWiseStep, segment[0]];
      }

      //push the new segments we found to all the segments for the next forward iteration
      resultingSegments = resultingSegments.concat(newNextSegments);
    }

    //if we were able to come full circle like this:
    //
    //  aaaaaaaaa
    //  a       a
    //  a   a   a
    //  a       a
    //  aaaaaaaaa
    //while continuing after end we hit our own start so we expected the next segment to continue our open segment. This obviously didn't happen. Thats why we have to generate an end for our segment
    if (resultingSegments.length == 1 && resultingSegments[0].length == 1) {
      resultingSegments = [[0, mod(-1, nextIterationSize)]];
    }
    //this case is supposed to trigger if the lastSegment connects with the first segment. In that case we need to connect the two. I'm not sure if this works. The last segment should generate a proper segment since we backtracked from the start segment to the end of the last segment which now can't continue past it's end so it will never hit our start so it will never generate a half open segment
    else if (
      resultingSegments.length > 0 &&
      resultingSegments[resultingSegments.length - 1].length == 1
    ) {
      let first = resultingSegments[0];
      let last = resultingSegments[resultingSegments.length - 1];
      resultingSegments.shift();
      resultingSegments.pop();
      resultingSegments.push([last[0], first[first.length - 1]]);
    }

    //expand fill with the segments that we found in our direction
    if (resultingSegments.length > 0)
      this.expandFill(
        imageData,
        startPos,
        nextIteration,
        resultingSegments,
        direction,
        fillColor,
        targetColor
      );

    //expand fill in the other direction with the segments we found by backtracking
    if (inverseSegments.length > 0)
      this.expandFill(
        imageData,
        startPos,
        nextIteration,
        inverseSegments,
        direction * -1,
        fillColor,
        targetColor
      );
  }

  //checks if a pixel with index and iteration is inside tha canvas bounds
  pixelIndexInsideBounds(startPos, iteration, index) {
    let pixelPos = this.indexToPosition(startPos, iteration, index);
    return (
      pixelPos[0] >= 0 &&
      pixelPos[0] < this.canvas.width &&
      pixelPos[1] >= 0 &&
      pixelPos[1] < this.canvas.height
    );
  }

  // since our focus area in form of a square we can represent a pixel in our focus area as an index.
  //  -----a--
  //  |      |
  //  |      |
  //  --------
  // we begin counting in the top left corner
  indexToPosition(startPos, iteration, index) {
    //with each iteration each side of our square gains two pixels
    //this determines which side of the square our pixel is on
    //0 = top, 1 = left, 2 = bottom, 3 = right
    //if we are on the top our Y Coordinate is start.y - iteration.
    //Our X position on the square should be index % (iteration * 2)
    //However we must move this relative to the center of the square. We know the width of the square is iteration * 2 so we must subtract iteration
    //Now just take the result of that and add start.x
    //same goes for bottom
    //left and right have the roles of x and y switched
    switch (Math.floor(index / (iteration * 2))) {
      case 0:
        return [
          startPos[0] + (index % (iteration * 2)) - iteration,
          startPos[1] - iteration,
        ];
      case 1:
        return [
          startPos[0] + iteration,
          startPos[1] + (index % (iteration * 2)) - iteration,
        ];
      case 2:
        return [
          startPos[0] - ((index % (iteration * 2)) - iteration),
          startPos[1] + iteration,
        ];
      default:
        return [
          startPos[0] - iteration,
          startPos[1] - ((index % (iteration * 2)) - iteration),
        ];
    }
  }

  //this develops a pixel in a specific direction. If the square is growing (direction = 1) the pixel should get it's respective position on the larger square.
  //if the square is shrinking (direction = -1) the pixel should get it's respective position on the smaller square
  //one special case are corners. They don't have well defined position in the next square (or previous square)
  //let's look at an example:
  //  aabcdefgh
  //  aabcdefgh
  //  ii
  //  jj
  //  kk
  //  this represents a corner. Its relatively clear what the next / previous position of a letter is except for the "a". When expanding the a should turn into the a on the right side of the outer square.
  //  when collapsing the a's should all transform into the inner a
  //
  //  expanding normal letters looks like this index + 1 + 2 * (sideImOn)
  //  shrinking normal letters looks like this index - 1 - 2 * (sideImOn)
  //  so in general index + direction + direction * 2 * (sideImOn)
  //  this formula works for expanding and shrinking for all blocks except corner-blocks
  //  if we are operating on a corner-block we must subtract direction once.
  //  in theory we could end in the negative space thats why we must mod pixel amount (iteration * 8)
  //  in javascript this can return a negative number (??) thats why we must do this: ((n % m) + m) % m
  developPixel(iteration, index, direction) {
    let newPos =
      index +
      direction +
      direction * 2 * (iteration ? Math.floor(index / (iteration * 2)) : 0);
    if (index % (iteration * 2) == 0 || iteration == 0) {
      //move the positive direction back by two move the negative direction back by one
      newPos -= (direction + 1) * 1.5 - 1;
    }
    let nextIterationPixelCount = (iteration + direction) * 8;
    return mod(newPos, nextIterationPixelCount ? nextIterationPixelCount : 1);
  }

  //compare each color channel in the two pixels
  compareImageDataColors(color1, color2) {
    window.pixelMatchingOperations++;
    return (
      color1[0] == color2[0] &&
      color1[1] == color2[1] &&
      color1[2] == color2[2] &&
      color1[3] == color2[3]
    );
  }

  //set rgba value of a pixel as array: [r, g, b, a]
  setImageDataPixel(imageData, pos, color) {
    let start = this.canvas.width * 4 * pos[1] + 4 * pos[0];
    imageData.data[start] = color[0];
    imageData.data[start + 1] = color[1];
    imageData.data[start + 2] = color[2];
    imageData.data[start + 3] = color[3];
    //this.ctx.putImageData(imageData, 0, 0);
    //await new Promise((r) => setTimeout(r, 1));
  }

  //get rgba value of a pixel as array: [r, g, b, a]
  getImageDataPixel(imageData, pos) {
    let start = this.canvas.width * 4 * pos[1] + 4 * pos[0];
    return [
      imageData.data[start],
      imageData.data[start + 1],
      imageData.data[start + 2],
      imageData.data[start + 3],
    ];
  }

  //set the color by pixel index and iteration
  setImageDataPixelIndex(imageData, startPos, iteration, index, color) {
    this.setImageDataPixel(
      imageData,
      this.indexToPosition(startPos, iteration, index),
      color
    );
  }

  //get the color by pixel index and iteration
  getImageDataPixelIndex(imageData, startPos, iteration, index) {
    return this.getImageDataPixel(
      imageData,
      this.indexToPosition(startPos, iteration, index)
    );
  }
}


const mod = (n, m) => {
  return ((n % m) + m) % m;
};
