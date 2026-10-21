import { describe, expect, it } from 'vitest';
import { canTransitionEpisode, transitionEpisode, transitionSeries, TransitionError } from '../src/index.js';

describe('state machine', () => {
  it('walks the happy path for an episode', () => {
    let s = transitionEpisode('planned', 'scripted');
    s = transitionEpisode(s, 'shots_ready');
    s = transitionEpisode(s, 'prompts_ready');
    s = transitionEpisode(s, 'generating');
    s = transitionEpisode(s, 'qc');
    s = transitionEpisode(s, 'generating'); // regen loop
    s = transitionEpisode(s, 'qc');
    s = transitionEpisode(s, 'draft_approved');
    s = transitionEpisode(s, 'assembling');
    s = transitionEpisode(s, 'final_ready');
    expect(transitionEpisode(s, 'exported')).toBe('exported');
  });
  it('refuses skipping ahead', () => {
    expect(canTransitionEpisode('planned', 'generating')).toBe(false);
    expect(() => transitionEpisode('planned', 'exported')).toThrow(TransitionError);
    expect(() => transitionSeries('planning', 'production')).toThrow(/เปลี่ยนสถานะซีรีส์/);
  });
});
