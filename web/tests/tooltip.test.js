/** @vitest-environment jsdom */
import { describe, it, expect, beforeEach } from 'vitest';
import { withTooltip, renderContent, hideTooltip } from '../src/ui/tooltip.js';
import { PARAM_HELP, C_RAD_HELP, C_RAD_PRESETS } from '../src/ui/paramHelp.js';

function mount(content = 'plain') {
  document.body.innerHTML = '<span id="lbl">Fragments</span>';
  const label = document.getElementById('lbl');
  withTooltip(label, content);
  return document.querySelector('.tt-trigger');
}

const bubble = () => document.querySelector('.tt-bubble');

describe('tooltip behaviour required by WCAG 2.2 SC 1.4.13', () => {
  beforeEach(() => hideTooltip());

  it('opens on keyboard focus, which is what title never did', () => {
    const trigger = mount();
    expect(bubble().hidden).toBe(true);
    trigger.dispatchEvent(new window.FocusEvent('focus'));
    expect(bubble().hidden).toBe(false);
  });

  it('opens on hover as well', () => {
    const trigger = mount();
    trigger.dispatchEvent(new window.Event('pointerenter'));
    expect(bubble().hidden).toBe(false);
  });

  it('is dismissable with Escape without moving the pointer', () => {
    const trigger = mount();
    trigger.dispatchEvent(new window.FocusEvent('focus'));
    document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(bubble().hidden).toBe(true);
  });

  it('is hoverable: moving onto the bubble cancels the hide', async () => {
    // This is what makes a citation inside the bubble clickable at all.
    const trigger = mount();
    trigger.dispatchEvent(new window.FocusEvent('focus'));
    trigger.dispatchEvent(new window.Event('pointerleave'));
    bubble().dispatchEvent(new window.Event('pointerenter'));
    await new Promise(r => setTimeout(r, 220));
    expect(bubble().hidden).toBe(false);
  });

  it('points the trigger at the bubble for a screen reader', () => {
    const trigger = mount();
    trigger.dispatchEvent(new window.FocusEvent('focus'));
    expect(trigger.getAttribute('aria-describedby')).toBe(bubble().id);
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
  });

  it('leaves the label alone when there is nothing to say', () => {
    document.body.innerHTML = '<span id="lbl">Fragments</span>';
    const label = document.getElementById('lbl');
    expect(withTooltip(label, '')).toBe(label);
    expect(document.querySelector('.tt-trigger')).toBeNull();
  });
});

describe('renderContent', () => {
  it('puts the numbers in a separate block from the prose', () => {
    const html = renderContent({
      what: 'A thing.', effect: 'It does something.', def: '2.0', unit: 'm',
    });
    expect(html).toContain('<b>A thing.</b>');
    expect(html).toContain('tt-meta');
    expect(html).toContain('default 2.0 m');
  });

  it('omits the published range for a parameter nobody is arguing about', () => {
    // The absence of that line is itself information.
    const html = renderContent({ what: 'x', def: '1' });
    expect(html).not.toContain('published range');
  });

  it('carries the range and the source when there is one', () => {
    const html = renderContent(C_RAD_HELP);
    expect(html).toContain('published range 2.5e-5 to 4.3e-4');
    expect(html).toContain('Mileikowsky');
    expect(html).toContain('tt-warn');
  });
});

describe('the written explanations', () => {
  it('covers every parameter the solver exposes', async () => {
    const schema = (await import('../src/paramSchema.json')).default;
    const missing = schema.parameters
      .map(p => p.key)
      // radius_max and v_max are drawn as one paired control with their min.
      .filter(k => !['radius_max', 'v_max'].includes(k))
      .filter(k => !PARAM_HELP[k]);
    expect(missing).toEqual([]);
  });

  it('says what q_size decides, since that is why it was exposed', () => {
    const text = JSON.stringify(PARAM_HELP.q_size);
    expect(text).toContain('2 mm');
    expect(text).toContain('shield');
  });

  it('warns that the acute band does not apply to cosmic rays', () => {
    expect(C_RAD_HELP.warn).toContain('does NOT');
    expect(C_RAD_HELP.warn).toContain('cross-section saturates');
  });
});

describe('organism presets', () => {
  it('spans the published band and flags the one outside it', () => {
    const values = C_RAD_PRESETS.map(p => p.value);
    expect(Math.min(...values)).toBe(2.5e-5);
    const acute = C_RAD_PRESETS.find(p => p.value > 4.3e-4);
    expect(acute.note).toContain('does not transfer');
  });

  it('names organisms rather than abstract coefficients', () => {
    // A coefficient is abstract; an organism is not.
    expect(C_RAD_PRESETS.map(p => p.label).join(' ')).toContain('radiodurans');
    expect(C_RAD_PRESETS.map(p => p.label).join(' ')).toContain('subtilis');
  });
});
