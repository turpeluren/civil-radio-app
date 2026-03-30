import { getArtistInitials, getFirstLetter, minDelay } from '../stringHelpers';

describe('getFirstLetter', () => {
  it('returns uppercase letter for letter input', () => {
    expect(getFirstLetter('A')).toBe('A');
    expect(getFirstLetter('Z')).toBe('Z');
  });

  it('returns uppercase for lowercase input', () => {
    expect(getFirstLetter('a')).toBe('A');
    expect(getFirstLetter('hello')).toBe('H');
  });

  it('returns # for number', () => {
    expect(getFirstLetter('1')).toBe('#');
    expect(getFirstLetter('42')).toBe('#');
  });

  it('returns # for symbol', () => {
    expect(getFirstLetter('!')).toBe('#');
    expect(getFirstLetter('@')).toBe('#');
  });

  it('returns # for empty string', () => {
    expect(getFirstLetter('')).toBe('#');
  });

  it('returns # for non-ASCII letters (regex matches A-Z only)', () => {
    expect(getFirstLetter('É')).toBe('#');
    expect(getFirstLetter('ñ')).toBe('#');
  });
});

describe('getArtistInitials', () => {
  it('returns first 2 letters for single-word name', () => {
    expect(getArtistInitials('Prince')).toBe('PR');
    expect(getArtistInitials('Beyoncé')).toBe('BE');
  });

  it('returns first letter of first 2 words for multi-word name', () => {
    expect(getArtistInitials('Daft Punk')).toBe('DP');
    expect(getArtistInitials('Foo Fighters')).toBe('FF');
  });

  it('strips "The" prefix', () => {
    expect(getArtistInitials('The Beatles')).toBe('BE');
    expect(getArtistInitials('The Rolling Stones')).toBe('RS');
  });

  it('strips "A" prefix', () => {
    expect(getArtistInitials('A Tribe Called Quest')).toBe('TC');
  });

  it('strips "An" prefix', () => {
    expect(getArtistInitials('An Albatross')).toBe('AL');
  });

  it('strips Spanish articles', () => {
    expect(getArtistInitials('El Canto del Loco')).toBe('CD');
    expect(getArtistInitials('La Oreja de Van Gogh')).toBe('OD');
    expect(getArtistInitials('Los Lobos')).toBe('LO');
    expect(getArtistInitials('Las Ketchup')).toBe('KE');
  });

  it('strips French articles', () => {
    expect(getArtistInitials('Le Tigre')).toBe('TI');
    expect(getArtistInitials('Les Misérables')).toBe('MI');
  });

  it('strips German articles', () => {
    expect(getArtistInitials('Die Antwoord')).toBe('AN');
    expect(getArtistInitials('Der Plan')).toBe('PL');
    expect(getArtistInitials('Das Racist')).toBe('RA');
  });

  it('strips Italian articles', () => {
    expect(getArtistInitials('Il Divo')).toBe('DI');
    expect(getArtistInitials('Lo Stato Sociale')).toBe('SS');
    expect(getArtistInitials('Gli Amici')).toBe('AM');
  });

  it('strips Portuguese articles', () => {
    expect(getArtistInitials('Os Mutantes')).toBe('MU');
    expect(getArtistInitials('As Meninas')).toBe('ME');
  });

  it('is case-insensitive for prefix stripping', () => {
    expect(getArtistInitials('the beatles')).toBe('BE');
    expect(getArtistInitials('THE BEATLES')).toBe('BE');
  });

  it('does not strip prefix that is the entire name', () => {
    expect(getArtistInitials('The')).toBe('TH');
    expect(getArtistInitials('A')).toBe('A');
  });

  it('handles extra whitespace', () => {
    expect(getArtistInitials('  Daft  Punk  ')).toBe('DP');
  });

  it('handles single letter name', () => {
    expect(getArtistInitials('X')).toBe('X');
  });

  it('returns first 2 letters when prefix strip leaves single word', () => {
    expect(getArtistInitials('The Weeknd')).toBe('WE');
  });
});

describe('minDelay', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('resolves after specified ms', async () => {
    const p = minDelay(500);
    jest.advanceTimersByTime(500);
    await expect(p).resolves.toBeUndefined();
  });

  it('does not resolve before specified ms', async () => {
    let resolved = false;
    minDelay(500).then(() => { resolved = true; });
    jest.advanceTimersByTime(499);
    await Promise.resolve();
    expect(resolved).toBe(false);
    jest.advanceTimersByTime(1);
    await Promise.resolve();
    expect(resolved).toBe(true);
  });

  it('uses default 2000ms when no arg', async () => {
    let resolved = false;
    minDelay().then(() => { resolved = true; });
    jest.advanceTimersByTime(1999);
    await Promise.resolve();
    expect(resolved).toBe(false);
    jest.advanceTimersByTime(1);
    await Promise.resolve();
    expect(resolved).toBe(true);
  });

  it('resolves immediately when ms is 0', async () => {
    const p = minDelay(0);
    jest.advanceTimersByTime(0);
    await expect(p).resolves.toBeUndefined();
  });
});
