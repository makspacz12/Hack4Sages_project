import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { JSDOM } from 'jsdom';

describe('infoPanel', () => {
  let infoPanel;
  let dom;

  beforeEach(async () => {
    // Setup minimal DOM environment (createInfoPanel creates #info-panel itself)
    dom = new JSDOM('<!DOCTYPE html><body></body>');
    global.document = dom.window.document;
    global.window = dom.window;

    // Dynamically import the module (it depends on document)
    const { createInfoPanel } = await import('../src/infoPanel.js');
    infoPanel = createInfoPanel();
  });

  afterEach(() => {
    infoPanel.hide();
    delete global.document;
    delete global.window;
  });

  test('show() with null positions/velocities/properties', () => {
    const simObj = { id: 'asteroid1', name: 'Test Asteroid', info: { radius: 100, mass: 1e15 } };
    infoPanel.show(simObj, null, null, null, 'km');
    
    const panel = document.getElementById('info-panel');
    expect(panel.classList.contains('visible')).toBe(true);
    expect(panel.textContent).toContain('Test Asteroid');
  });

  test('show() with properties containing radiation data', () => {
    const simObj = { id: 'asteroid1', name: 'Rock A', info: { radius: 50 } };
    const positions = [{ id: 'asteroid1', x: 1000, y: 2000, z: -500 }];
    const velocities = [{ id: 'asteroid1', vx: 10, vy: -5, vz: 3 }];
    const properties = [{
      id: 'asteroid1',
      rock_type: 'ice_rich',
      uv_local_flux: 1.234e5,
      gcr_local_flux: 0.05,
      gamma_local_flux: 2.5,
      T_surface_K: 150.5,
      T_center_K: 180.2,
      population_fraction: 0.89,
      hydrolysis_rate_s_inv: 3.2e-9,
      uranium238_ppm: 0.012,
      thorium232_ppm: 0.045,
      potassium_percent: 0.02,
      radiation_decay_gy_per_year: 0.001
    }];

    infoPanel.show(simObj, positions, velocities, properties, 'km');
    
    const panel = document.getElementById('info-panel');
    expect(panel.classList.contains('visible')).toBe(true);
    
    const text = panel.textContent;
    expect(text).toContain('Rock A');
    expect(text).toContain('Position (current frame)');
    expect(text).toContain('Velocity (current frame)');
    expect(text).toContain('Radiation (current frame)');
    expect(text).toContain('UV flux');
    expect(text).toContain('GCR flux');
    expect(text).toContain('Gamma flux');
    expect(text).toContain('Temperature (current frame)');
    expect(text).toContain('Surface');
    expect(text).toContain('Center');
    expect(text).toContain('Biology (current frame)');
    expect(text).toContain('Population');
    expect(text).toContain('89%'); // population_fraction * 100 displayed as bar
    expect(text).toContain('Rock properties');
    expect(text).toContain('Type');
    expect(text).toContain('ice_rich');
    expect(text).toContain('U-238');
    expect(text).toContain('Th-232');
  });

  test('updateFrame() updates live data when properties change', () => {
    const simObj = { id: 'asteroid2', name: 'Rock B', info: { radius: 30 } };
    const positions1 = [{ id: 'asteroid2', x: 100, y: 200, z: 300 }];
    const properties1 = [{
      id: 'asteroid2',
      T_surface_K: 120,
      T_center_K: 150,
      population_fraction: 0.5
    }];

    infoPanel.show(simObj, positions1, null, properties1, 'm');
    
    const panel = document.getElementById('info-panel');
    expect(panel.textContent).toContain('120');
    expect(panel.textContent).toContain('150');
    expect(panel.textContent).toContain('50%'); // population_fraction as bar

    // Simulate frame advance with different temperature/population
    const positions2 = [{ id: 'asteroid2', x: 110, y: 210, z: 310 }];
    const properties2 = [{
      id: 'asteroid2',
      T_surface_K: 130,
      T_center_K: 160,
      population_fraction: 0.45
    }];

    infoPanel.updateFrame(positions2, null, properties2, 'm');
    
    const updatedText = panel.textContent;
    expect(updatedText).toContain('130');
    expect(updatedText).toContain('160');
    expect(updatedText).toContain('45%'); // updated population
    expect(updatedText).not.toContain('50%');
  });

  test('show() handles properties array with no matching id', () => {
    const simObj = { id: 'asteroid3', name: 'Rock C', info: { radius: 20 } };
    const positions = [{ id: 'asteroid3', x: 0, y: 0, z: 0 }];
    const properties = [{ id: 'different_asteroid', T_surface_K: 100 }];

    infoPanel.show(simObj, positions, null, properties, 'km');
    
    const panel = document.getElementById('info-panel');
    expect(panel.classList.contains('visible')).toBe(true);
    expect(panel.textContent).toContain('Rock C');
    // Should show position, but no radiation/temperature sections
    expect(panel.textContent).toContain('Position (current frame)');
    expect(panel.textContent).not.toContain('Radiation (current frame)');
    expect(panel.textContent).not.toContain('Temperature (current frame)');
  });

  test('show() handles partial property data', () => {
    const simObj = { id: 'asteroid4', name: 'Rock D', info: { radius: 40 } };
    const positions = [{ id: 'asteroid4', x: 500, y: 0, z: 0 }];
    const properties = [{
      id: 'asteroid4',
      rock_type: 'ordinary_chondrite',
      T_surface_K: 200
      // Missing T_center_K, radiation fluxes, biology data
    }];

    infoPanel.show(simObj, positions, null, properties, 'au');
    
    const panel = document.getElementById('info-panel');
    const text = panel.textContent;
    
    expect(text).toContain('ordinary_chondrite');
    expect(text).toContain('Temperature (current frame)');
    expect(text).toContain('200');
    // Should NOT show radiation or biology sections since their fields are missing
    expect(text).not.toContain('Radiation (current frame)');
    expect(text).not.toContain('Biology (current frame)');
  });

  test('hide() removes the panel', () => {
    const simObj = { id: 'asteroid5', name: 'Rock E', info: { radius: 10 } };
    infoPanel.show(simObj, null, null, null, 'km');
    
    const panel = document.getElementById('info-panel');
    expect(panel.classList.contains('visible')).toBe(true);
    
    infoPanel.hide();
    expect(panel.classList.contains('visible')).toBe(false);
  });
});
