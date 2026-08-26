/**
 * picker.js
 * Raycasting-based object picker for click-to-focus.
 * Distinguishes clicks from drags so orbiting the camera doesn't trigger selection.
 */

import * as THREE from 'three';

/**
 * Convert a mouse/pointer event to Normalised Device Coordinates (-1..1).
 * @param {MouseEvent} event
 * @param {HTMLElement} domElement
 * @returns {THREE.Vector2}
 */
export function eventToNDC(event, domElement) {
  const rect = domElement.getBoundingClientRect();
  return new THREE.Vector2(
    ((event.clientX - rect.left) / rect.width)  *  2 - 1,
    ((event.clientY - rect.top)  / rect.height) * -2 + 1,
  );
}

/**
 * Cast a ray from the camera through NDC coords and return the first mesh hit.
 * @param {THREE.Vector2}   ndc
 * @param {THREE.Camera}    camera
 * @param {THREE.Mesh[]}    meshes   flat list to test against
 * @returns {THREE.Mesh|null}
 */
export function raycastMeshes(ndc, camera, meshes) {
  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(ndc, camera);
  const hits = raycaster.intersectObjects(meshes, false);
  return hits.length > 0 ? hits[0].object : null;
}

/**
 * Register mousedown/mouseup listeners that fire onHit(mesh) on a clean click
 * (mouse travel < 5 px) and onMiss() when nothing is hit.
 *
 * @param {HTMLElement}           domElement
 * @param {THREE.Camera}          camera
 * @param {() => THREE.Mesh[]}    getMeshes  called lazily so list stays current
 * @param {(mesh: THREE.Mesh) => void} onHit
 * @param {() => void}            [onMiss]
 * @returns {() => void}  cleanup / unregister function
 */
export function registerClickHandler(domElement, camera, getMeshes, onHit, onMiss) {
  let downX = 0;
  let downY = 0;

  function handleMouseDown(e) {
    downX = e.clientX;
    downY = e.clientY;
  }

  function handleMouseUp(e) {
    const dx = e.clientX - downX;
    const dy = e.clientY - downY;
    if (dx * dx + dy * dy > 25) return; // drag → ignore

    const ndc  = eventToNDC(e, domElement);
    const mesh = raycastMeshes(ndc, camera, getMeshes());
    if (mesh) onHit(mesh);
    else onMiss?.();
  }

  domElement.addEventListener('mousedown', handleMouseDown);
  domElement.addEventListener('mouseup',   handleMouseUp);

  return () => {
    domElement.removeEventListener('mousedown', handleMouseDown);
    domElement.removeEventListener('mouseup',   handleMouseUp);
  };
}
