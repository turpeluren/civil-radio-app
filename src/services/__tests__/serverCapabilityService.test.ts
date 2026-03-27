jest.mock('../../store/sqliteStorage', () => require('../../store/__mocks__/sqliteStorage'));

import { serverInfoStore } from '../../store/serverInfoStore';
import { supports } from '../serverCapabilityService';

function setServerInfo(overrides: {
	serverType?: string | null;
	apiVersion?: string | null;
}) {
	serverInfoStore.getState().setServerInfo({
		serverType: overrides.serverType ?? null,
		serverVersion: null,
		apiVersion: overrides.apiVersion ?? null,
		openSubsonic: overrides.serverType != null,
		extensions: [],
		lastFetchedAt: null,
	});
}

beforeEach(() => {
	serverInfoStore.getState().clearServerInfo();
});

describe('supports', () => {
	describe('Navidrome', () => {
		beforeEach(() => setServerInfo({ serverType: 'navidrome' }));

		it('supports all capabilities', () => {
			expect(supports('shares')).toBe(true);
			expect(supports('scan')).toBe(true);
			expect(supports('fullScan')).toBe(true);
			expect(supports('albumArtistRating')).toBe(true);
			expect(supports('internetRadioCrud')).toBe(true);
		});
	});

	describe('Gonic', () => {
		beforeEach(() => setServerInfo({ serverType: 'gonic' }));

		it('supports albumArtistRating only', () => {
			expect(supports('albumArtistRating')).toBe(true);
		});

		it('does not support shares, scan, fullScan, internetRadioCrud', () => {
			expect(supports('shares')).toBe(false);
			expect(supports('scan')).toBe(false);
			expect(supports('fullScan')).toBe(false);
			expect(supports('internetRadioCrud')).toBe(false);
		});
	});

	describe('Classic Subsonic at API 1.16.1', () => {
		beforeEach(() => setServerInfo({ apiVersion: '1.16.1' }));

		it('supports shares, scan, internetRadioCrud', () => {
			expect(supports('shares')).toBe(true);
			expect(supports('scan')).toBe(true);
			expect(supports('internetRadioCrud')).toBe(true);
		});

		it('does not support fullScan or albumArtistRating', () => {
			expect(supports('fullScan')).toBe(false);
			expect(supports('albumArtistRating')).toBe(false);
		});
	});

	describe('Classic Subsonic at API 1.16.0', () => {
		beforeEach(() => setServerInfo({ apiVersion: '1.16.0' }));

		it('supports shares, scan, internetRadioCrud', () => {
			expect(supports('shares')).toBe(true);
			expect(supports('scan')).toBe(true);
			expect(supports('internetRadioCrud')).toBe(true);
		});

		it('does not support fullScan or albumArtistRating', () => {
			expect(supports('fullScan')).toBe(false);
			expect(supports('albumArtistRating')).toBe(false);
		});
	});

	describe('Classic Subsonic at API 1.15.0', () => {
		beforeEach(() => setServerInfo({ apiVersion: '1.15.0' }));

		it('supports shares and scan', () => {
			expect(supports('shares')).toBe(true);
			expect(supports('scan')).toBe(true);
		});

		it('does not support internetRadioCrud, fullScan, or albumArtistRating', () => {
			expect(supports('internetRadioCrud')).toBe(false);
			expect(supports('fullScan')).toBe(false);
			expect(supports('albumArtistRating')).toBe(false);
		});
	});

	describe('Classic Subsonic at API 1.14.0', () => {
		beforeEach(() => setServerInfo({ apiVersion: '1.14.0' }));

		it('supports shares only', () => {
			expect(supports('shares')).toBe(true);
		});

		it('does not support scan, internetRadioCrud, fullScan, or albumArtistRating', () => {
			expect(supports('scan')).toBe(false);
			expect(supports('internetRadioCrud')).toBe(false);
			expect(supports('fullScan')).toBe(false);
			expect(supports('albumArtistRating')).toBe(false);
		});
	});

	describe('Classic Subsonic below API 1.14.0', () => {
		beforeEach(() => setServerInfo({ apiVersion: '1.13.0' }));

		it('does not support any capability', () => {
			expect(supports('shares')).toBe(false);
			expect(supports('scan')).toBe(false);
			expect(supports('internetRadioCrud')).toBe(false);
			expect(supports('fullScan')).toBe(false);
			expect(supports('albumArtistRating')).toBe(false);
		});
	});

	describe('No server info', () => {
		it('returns false for all capabilities', () => {
			expect(supports('shares')).toBe(false);
			expect(supports('scan')).toBe(false);
			expect(supports('fullScan')).toBe(false);
			expect(supports('albumArtistRating')).toBe(false);
			expect(supports('internetRadioCrud')).toBe(false);
		});
	});

	describe('Case insensitivity', () => {
		it('matches Navidrome case-insensitively', () => {
			setServerInfo({ serverType: 'Navidrome' });
			expect(supports('shares')).toBe(true);
			expect(supports('fullScan')).toBe(true);
		});

		it('matches GONIC case-insensitively', () => {
			setServerInfo({ serverType: 'GONIC' });
			expect(supports('albumArtistRating')).toBe(true);
			expect(supports('shares')).toBe(false);
		});

		it('matches Nextcloud Music case-insensitively', () => {
			setServerInfo({ serverType: 'Nextcloud Music' });
			expect(supports('albumArtistRating')).toBe(true);
			expect(supports('shares')).toBe(false);
		});

		it('matches AMPACHE case-insensitively', () => {
			setServerInfo({ serverType: 'AMPACHE' });
			expect(supports('albumArtistRating')).toBe(true);
			expect(supports('shares')).toBe(false);
		});
	});

	describe('Nextcloud Music', () => {
		beforeEach(() => setServerInfo({ serverType: 'nextcloud music' }));

		it('supports albumArtistRating', () => {
			expect(supports('albumArtistRating')).toBe(true);
		});

		it('does not support shares, scan, fullScan, internetRadioCrud', () => {
			expect(supports('shares')).toBe(false);
			expect(supports('scan')).toBe(false);
			expect(supports('fullScan')).toBe(false);
			expect(supports('internetRadioCrud')).toBe(false);
		});
	});

	describe('Ampache', () => {
		beforeEach(() => setServerInfo({ serverType: 'ampache' }));

		it('supports albumArtistRating', () => {
			expect(supports('albumArtistRating')).toBe(true);
		});

		it('does not support shares, scan, fullScan, internetRadioCrud', () => {
			expect(supports('shares')).toBe(false);
			expect(supports('scan')).toBe(false);
			expect(supports('fullScan')).toBe(false);
			expect(supports('internetRadioCrud')).toBe(false);
		});
	});

	describe('Unknown OpenSubsonic server', () => {
		it('falls through to API version gating', () => {
			setServerInfo({ serverType: 'funkwhale', apiVersion: '1.16.0' });
			expect(supports('shares')).toBe(true);
			expect(supports('scan')).toBe(true);
			expect(supports('internetRadioCrud')).toBe(true);
			expect(supports('fullScan')).toBe(false);
			expect(supports('albumArtistRating')).toBe(false);
		});

		it('returns false with no API version', () => {
			setServerInfo({ serverType: 'funkwhale' });
			expect(supports('shares')).toBe(false);
		});
	});
});
