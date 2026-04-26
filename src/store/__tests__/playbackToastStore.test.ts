import { playbackToastStore } from '../playbackToastStore';

beforeEach(() => {
  jest.useFakeTimers();
  playbackToastStore.setState({
    status: 'idle',
    errorMessage: null,
    successLabel: null,
    _showedAt: 0,
  });
});

afterEach(() => {
  jest.useRealTimers();
});

describe('playbackToastStore', () => {
  it('show sets loading status', () => {
    playbackToastStore.getState().show();
    expect(playbackToastStore.getState().status).toBe('loading');
  });

  it('show clears any previous errorMessage', () => {
    playbackToastStore.setState({ status: 'error', errorMessage: 'old error' });
    playbackToastStore.getState().show();
    expect(playbackToastStore.getState().errorMessage).toBeNull();
  });

  it('succeed waits minimum duration before transitioning', () => {
    playbackToastStore.getState().show();
    playbackToastStore.getState().succeed();
    expect(playbackToastStore.getState().status).toBe('loading');
    jest.advanceTimersByTime(1200);
    expect(playbackToastStore.getState().status).toBe('success');
  });

  it('succeed transitions immediately when enough time has passed', () => {
    playbackToastStore.getState().show();
    jest.advanceTimersByTime(1500);
    playbackToastStore.getState().succeed();
    jest.advanceTimersByTime(0);
    expect(playbackToastStore.getState().status).toBe('success');
  });

  it('fail waits minimum duration before transitioning', () => {
    playbackToastStore.getState().show();
    playbackToastStore.getState().fail('Error');
    expect(playbackToastStore.getState().status).toBe('loading');
    jest.advanceTimersByTime(1200);
    expect(playbackToastStore.getState().status).toBe('error');
    expect(playbackToastStore.getState().errorMessage).toBe('Error');
  });

  it('fail transitions immediately when enough time has passed', () => {
    playbackToastStore.getState().show();
    jest.advanceTimersByTime(1500);
    playbackToastStore.getState().fail('Oops');
    jest.advanceTimersByTime(0);
    expect(playbackToastStore.getState().status).toBe('error');
    expect(playbackToastStore.getState().errorMessage).toBe('Oops');
  });

  it('hide resets to idle', () => {
    playbackToastStore.getState().show();
    playbackToastStore.getState().hide();
    expect(playbackToastStore.getState().status).toBe('idle');
  });

  it('hide clears errorMessage', () => {
    playbackToastStore.setState({ status: 'error', errorMessage: 'err' });
    playbackToastStore.getState().hide();
    expect(playbackToastStore.getState().errorMessage).toBeNull();
  });

  it('last call wins when succeed and fail race', () => {
    playbackToastStore.getState().show();
    playbackToastStore.getState().succeed();
    playbackToastStore.getState().fail('Error');
    jest.advanceTimersByTime(1200);
    expect(playbackToastStore.getState().status).toBe('error');
  });

  it('flashSuccess sets success status + custom label immediately (no loading delay)', () => {
    playbackToastStore.getState().flashSuccess('Added to download queue');
    const state = playbackToastStore.getState();
    expect(state.status).toBe('success');
    expect(state.successLabel).toBe('Added to download queue');
    expect(state.errorMessage).toBeNull();
  });

  it('hide clears successLabel', () => {
    playbackToastStore.getState().flashSuccess('Done');
    playbackToastStore.getState().hide();
    expect(playbackToastStore.getState().successLabel).toBeNull();
  });

  it('show resets successLabel so a subsequent loading→success uses default label', () => {
    playbackToastStore.getState().flashSuccess('Custom');
    playbackToastStore.getState().show();
    expect(playbackToastStore.getState().successLabel).toBeNull();
  });
});
