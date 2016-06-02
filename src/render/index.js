import PDFJSAnnotate from '../PDFJSAnnotate';
import appendChild from './appendChild';
import {
  pointIntersectsRect,
  scaleUp
} from '../UI/utils'; 

/**
 * Render the response from PDFJSAnnotate.StoreAdapter.getAnnotations to SVG
 *
 * @param {SVGElement} svg The SVG element to render the annotations to
 * @param {Object} viewport The page viewport data
 * @param {Object} data The response from PDFJSAnnotate.StoreAdapter.getAnnotations
 * @return {SVGElement} The SVG element that was rendered to
 */
export default function render(svg, viewport, data) {
  // Reset the content of the SVG
  svg.innerHTML = ''; 
  svg.setAttribute('data-pdf-annotate-container', true);
  svg.setAttribute('data-pdf-annotate-viewport', JSON.stringify(viewport));
  svg.removeAttribute('data-pdf-annotate-document');
  svg.removeAttribute('data-pdf-annotate-page');

  // If there's no data nothing can be done
  if (!data) {
    return svg;
  }

  svg.setAttribute('data-pdf-annotate-document', data.documentId);
  svg.setAttribute('data-pdf-annotate-page', data.pageNumber);
  
  // Make sure annotations is an array
  if (!Array.isArray(data.annotations) || data.annotations.length === 0) {
    return svg;
  }

  // Append annotation to svg
  data.annotations.forEach((a) => {
    appendChild(svg, a, viewport);
  });

  // Enable a11y
  // TODO this should def not use timeout, but is needed to wait for PDFJSText.render
  setTimeout(function () {
    insertScreenReaderHints(data.pageNumber, data.annotations);
  }, 5000);

  return svg;
}

/**
 * Insert hints into the DOM for screen readers.
 *
 * @param {Number} pageNumber The page number that hints are inserted for
 * @param {Array} annotations The annotations that hints are inserted for
 */
function insertScreenReaderHints(pageNumber, annotations) {
  let count = {};
  annotations.forEach((a) => {
    // Keep count of each hinted annotation to make it more clear to screen reader
    if (!count[a.type]) {
      count[a.type] = 0;
    }
    count[a.type]++;

    if (['highlight', 'strikeout'].includes(a.type)) {
      let rects = a.rectangles;
      let first = rects[0];
      let last = rects[rects.length - 1];
      insertElementAtPoint(
        createScreenReaderOnly(`Begin ${a.type} ${count[a.type]}`),
        first.x + 2, first.y + 2, pageNumber
      );
      // TODO this doesn't always insert accurately
      insertElementAtPoint(
        createScreenReaderOnly(`End ${a.type} ${count[a.type]}`),
        (last.x + last.width) - 2, last.y + 2, pageNumber
      );
    }
  });
}

/**
 * Insert an element at a point within the document
 *
 * @param {Element} el The element to be inserted
 * @param {Number} x The x coordinate of the point
 * @param {Number} y The y coordinate of the point
 * @param {Number} pageNumber The page number to limit elements to
 */
function insertElementAtPoint(el, x, y, pageNumber) {
  let node = elementFromPoint(x, y, pageNumber);
  if (!node) {
    return;
  }
  let svg = document.querySelector(`svg[data-pdf-annotate-page="${pageNumber}"]`);
  let rect = node.getBoundingClientRect();
  let temp = node.cloneNode(true);
  let head = temp.innerHTML.split('');
  let tail = [];
  temp.style.position = 'absolute';
  temp.style.top = '-10000px';
  temp.style.left = '-10000px';
  document.body.appendChild(temp);

  x = scaleUp(svg, {x}).x;

  while (head.length) {
    // Don't insert within HTML tags
    if (head[head.length - 1] === '>') {
      while(head.length) {
        tail.unshift(head.pop());
        if (tail[0] === '<') {
          break;
        }
      }
    }
    
    // Check if width of temp based on current head value satisfies x
    temp.innerHTML = head.join('');
    let width = temp.getBoundingClientRect().width;
    if (rect.left + width <= x) {
      break;
    }
    tail.unshift(head.pop());
  }
  
  // Update original node with new markup, including element to be inserted
  node.innerHTML = head.join('') + el.outerHTML + tail.join('');
  temp.parentNode.removeChild(temp);
}

/**
 * Get all text layer elements at a given point on a page
 *
 * @param {Number} x The x coordinate of the point
 * @param {Number} y The y coordinate of the point
 * @param {Number} pageNumber The page to limit elements to
 * @return {Element} First text layer element found at the point
 */
function elementFromPoint(x, y, pageNumber) {
  let svg = document.querySelector(`svg[data-pdf-annotate-page="${pageNumber}"]`);
  let rect = svg.getBoundingClientRect();
  y = scaleUp(svg, {y}).y;
  x = scaleUp(svg, {x}).x;
  return [...svg.parentNode.querySelectorAll('.textLayer [data-canvas-width]')].filter((el) => {
    return pointIntersectsRect(x + rect.left, y + rect.top, el.getBoundingClientRect());
  })[0];
}

/**
 * Create a node that is only visible to screen readers
 *
 * @param {String} content The text content that should be read by screen reader
 * @return {Element} An Element that is only visible to screen readers
 */
function createScreenReaderOnly(content) {
  let node = document.createElement('div');
  let text = document.createTextNode(content);
  node.appendChild(text);
  node.style.position = 'absolute';
  node.style.left = '-10000px';
  node.style.top = 'auto';
  node.style.width = '1px';
  node.style.height = '1px';
  node.style.overflow = 'hidden';
  return node;
}
