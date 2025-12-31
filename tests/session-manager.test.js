/**
 * SessionManager Test Suite
 * Covers: session creation, validation, storage, lifecycle
 * Coverage Target: 85%+
 */

describe('SessionManager', () => {
    let sessionManager;
    let mockStorage;

    beforeEach(() => {
        // Mock localStorage
        mockStorage = {};
        global.localStorage = {
            getItem: (key) => mockStorage[key] || null,
            setItem: (key, value) => { mockStorage[key] = value.toString(); },
            removeItem: (key) => { delete mockStorage[key]; },
            clear: () => { mockStorage = {}; }
        };

        // Initialize
        sessionManager = new SessionManager();
    });

    afterEach(() => {
        sessionManager.clear();
        mockStorage = {};
    });

    describe('Initialization', () => {
        test('should initialize with empty session', () => {
            expect(sessionManager.isSessionActive()).toBe(false);
            expect(sessionManager.getSession()).toBeNull();
        });

        test('should have required methods', () => {
            expect(typeof sessionManager.createSession).toBe('function');
            expect(typeof sessionManager.getSession).toBe('function');
            expect(typeof sessionManager.isSessionActive).toBe('function');
            expect(typeof sessionManager.endSession).toBe('function');
        });
    });

    describe('Session Creation', () => {
        test('should create session with code', () => {
            const code = 'TEST123';
            sessionManager.createSession(code);
            expect(sessionManager.isSessionActive()).toBe(true);
            expect(sessionManager.getSession().code).toBe(code);
        });

        test('should store session in localStorage', () => {
            sessionManager.createSession('TEST123');
            expect(mockStorage[StorageKeys.SESSION]).toBeDefined();
        });

        test('should set creation timestamp', () => {
            const before = Date.now();
            sessionManager.createSession('TEST123');
            const after = Date.now();
            const session = sessionManager.getSession();
            expect(session.createdAt).toBeGreaterThanOrEqual(before);
            expect(session.createdAt).toBeLessThanOrEqual(after);
        });

        test('should generate unique session ID', () => {
            sessionManager.createSession('TEST123');
            const session1 = sessionManager.getSession();
            
            sessionManager.clear();
            sessionManager.createSession('TEST456');
            const session2 = sessionManager.getSession();
            
            expect(session1.id).not.toBe(session2.id);
        });
    });

    describe('Session Retrieval', () => {
        test('should retrieve active session', () => {
            sessionManager.createSession('TEST123');
            const session = sessionManager.getSession();
            expect(session).not.toBeNull();
            expect(session.code).toBe('TEST123');
        });

        test('should return null when no session', () => {
            expect(sessionManager.getSession()).toBeNull();
        });

        test('should restore session from storage', () => {
            sessionManager.createSession('TEST123');
            const originalSession = sessionManager.getSession();
            
            // Create new instance
            const newSessionManager = new SessionManager();
            const restoredSession = newSessionManager.getSession();
            
            expect(restoredSession).not.toBeNull();
            expect(restoredSession.id).toBe(originalSession.id);
        });
    });

    describe('Session Validation', () => {
        test('should validate session code', () => {
            sessionManager.createSession('VALID123');
            expect(sessionManager.isSessionActive()).toBe(true);
        });

        test('should reject invalid codes', () => {
            expect(() => sessionManager.createSession('')).toThrow();
        });

        test('should validate session expiration', () => {
            sessionManager.createSession('TEST123');
            const session = sessionManager.getSession();
            
            // Mock expiration
            session.createdAt = Date.now() - (25 * 60 * 60 * 1000); // 25 hours ago
            
            expect(sessionManager.isSessionValid()).toBe(false);
        });
    });

    describe('Session Termination', () => {
        test('should end session', () => {
            sessionManager.createSession('TEST123');
            expect(sessionManager.isSessionActive()).toBe(true);
            
            sessionManager.endSession();
            expect(sessionManager.isSessionActive()).toBe(false);
        });

        test('should clear storage on end session', () => {
            sessionManager.createSession('TEST123');
            sessionManager.endSession();
            expect(mockStorage[StorageKeys.SESSION]).toBeUndefined();
        });

        test('should handle end session on inactive session', () => {
            expect(() => sessionManager.endSession()).not.toThrow();
        });
    });

    describe('Session Clear', () => {
        test('should clear all session data', () => {
            sessionManager.createSession('TEST123');
            sessionManager.clear();
            expect(sessionManager.isSessionActive()).toBe(false);
            expect(sessionManager.getSession()).toBeNull();
        });
    });

    describe('Session Updates', () => {
        test('should update session data', () => {
            sessionManager.createSession('TEST123');
            sessionManager.updateSession({ hostName: 'John' });
            
            const session = sessionManager.getSession();
            expect(session.hostName).toBe('John');
        });

        test('should preserve existing data on update', () => {
            sessionManager.createSession('TEST123');
            const originalId = sessionManager.getSession().id;
            
            sessionManager.updateSession({ hostName: 'John' });
            const session = sessionManager.getSession();
            
            expect(session.id).toBe(originalId);
            expect(session.code).toBe('TEST123');
        });
    });

    describe('Multiple Sessions', () => {
        test('should replace previous session', () => {
            sessionManager.createSession('TEST123');
            const session1 = sessionManager.getSession();
            
            sessionManager.createSession('TEST456');
            const session2 = sessionManager.getSession();
            
            expect(session2.code).toBe('TEST456');
            expect(session1.id).not.toBe(session2.id);
        });
    });

    describe('Events', () => {
        test('should emit session-created event', (done) => {
            document.addEventListener('session-created', () => {
                expect(true).toBe(true);
                done();
            });
            sessionManager.createSession('TEST123');
        });

        test('should emit session-ended event', (done) => {
            sessionManager.createSession('TEST123');
            document.addEventListener('session-ended', () => {
                expect(true).toBe(true);
                done();
            });
            sessionManager.endSession();
        });
    });

    describe('Thread Safety', () => {
        test('should handle concurrent operations', (done) => {
            Promise.all([
                sessionManager.createSession('TEST1'),
                sessionManager.createSession('TEST2')
            ]).then(() => {
                // Should have latest session
                const session = sessionManager.getSession();
                expect(session).not.toBeNull();
                done();
            });
        });
    });
});
