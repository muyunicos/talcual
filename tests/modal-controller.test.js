/**
 * ModalController Test Suite
 * Covers: initialization, show/hide, event handling, cleanup
 * Coverage Target: 85%+
 */

describe('ModalController', () => {
    let modalController;
    let mockModal;
    let mockOverlay;

    beforeEach(() => {
        // Setup DOM
        mockOverlay = document.createElement('div');
        mockOverlay.className = 'modal-overlay';
        mockOverlay.id = 'modal-overlay';
        document.body.appendChild(mockOverlay);

        mockModal = document.createElement('div');
        mockModal.className = 'modal';
        mockModal.id = 'test-modal';
        document.body.appendChild(mockModal);

        // Create header and content
        const header = document.createElement('div');
        header.className = 'modal-header';
        const title = document.createElement('h2');
        title.textContent = 'Test Modal';
        header.appendChild(title);
        mockModal.appendChild(header);

        const content = document.createElement('div');
        content.className = 'modal-content';
        content.textContent = 'Test content';
        mockModal.appendChild(content);

        // Initialize
        modalController = new ModalController();
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    describe('Initialization', () => {
        test('should initialize with default state', () => {
            expect(modalController).toBeDefined();
            expect(modalController.isOpen).toBe(false);
            expect(modalController.currentModal).toBeNull();
        });

        test('should have show and hide methods', () => {
            expect(typeof modalController.show).toBe('function');
            expect(typeof modalController.hide).toBe('function');
        });
    });

    describe('Show Modal', () => {
        test('should display modal when show is called', () => {
            modalController.show('test-modal');
            expect(modalController.isOpen).toBe(true);
            expect(mockModal.classList.contains('active')).toBe(true);
        });

        test('should add active class to overlay', () => {
            modalController.show('test-modal');
            expect(mockOverlay.classList.contains('active')).toBe(true);
        });

        test('should trigger modal-opened event', (done) => {
            mockModal.addEventListener('modal-opened', () => {
                expect(true).toBe(true);
                done();
            });
            modalController.show('test-modal');
        });
    });

    describe('Hide Modal', () => {
        test('should hide modal when hide is called', () => {
            modalController.show('test-modal');
            modalController.hide();
            expect(modalController.isOpen).toBe(false);
            expect(mockModal.classList.contains('active')).toBe(false);
        });

        test('should remove active class from overlay', () => {
            modalController.show('test-modal');
            modalController.hide();
            expect(mockOverlay.classList.contains('active')).toBe(false);
        });

        test('should trigger modal-closed event', (done) => {
            modalController.show('test-modal');
            mockModal.addEventListener('modal-closed', () => {
                expect(true).toBe(true);
                done();
            });
            modalController.hide();
        });
    });

    describe('Event Handling', () => {
        test('should close modal on overlay click', () => {
            modalController.show('test-modal');
            mockOverlay.click();
            expect(modalController.isOpen).toBe(false);
        });

        test('should close modal on Escape key', () => {
            modalController.show('test-modal');
            const event = new KeyboardEvent('keydown', { key: 'Escape' });
            document.dispatchEvent(event);
            expect(modalController.isOpen).toBe(false);
        });

        test('should not close modal on other keys', () => {
            modalController.show('test-modal');
            const event = new KeyboardEvent('keydown', { key: 'Enter' });
            document.dispatchEvent(event);
            expect(modalController.isOpen).toBe(true);
        });
    });

    describe('Multiple Modals', () => {
        test('should handle multiple modals', () => {
            const modal2 = document.createElement('div');
            modal2.className = 'modal';
            modal2.id = 'test-modal-2';
            document.body.appendChild(modal2);

            modalController.show('test-modal');
            expect(modalController.currentModal).toBe('test-modal');

            modalController.show('test-modal-2');
            expect(modalController.currentModal).toBe('test-modal-2');
            expect(mockModal.classList.contains('active')).toBe(false);
        });
    });

    describe('State Management', () => {
        test('should maintain correct isOpen state', () => {
            expect(modalController.isOpen).toBe(false);
            modalController.show('test-modal');
            expect(modalController.isOpen).toBe(true);
            modalController.hide();
            expect(modalController.isOpen).toBe(false);
        });

        test('should track current modal correctly', () => {
            expect(modalController.currentModal).toBeNull();
            modalController.show('test-modal');
            expect(modalController.currentModal).toBe('test-modal');
            modalController.hide();
            expect(modalController.currentModal).toBeNull();
        });
    });

    describe('Edge Cases', () => {
        test('should handle double show gracefully', () => {
            modalController.show('test-modal');
            expect(modalController.isOpen).toBe(true);
            modalController.show('test-modal');
            expect(modalController.isOpen).toBe(true);
        });

        test('should handle hide on closed modal', () => {
            expect(() => modalController.hide()).not.toThrow();
            expect(modalController.isOpen).toBe(false);
        });

        test('should handle non-existent modal gracefully', () => {
            expect(() => modalController.show('non-existent')).not.toThrow();
        });
    });

    describe('Animation', () => {
        test('should apply animation classes', (done) => {
            modalController.show('test-modal');
            setTimeout(() => {
                expect(mockModal.classList.contains('animate-in')).toBe(true);
                done();
            }, 10);
        });

        test('should remove animation classes on hide', (done) => {
            modalController.show('test-modal');
            setTimeout(() => {
                modalController.hide();
                setTimeout(() => {
                    expect(mockModal.classList.contains('animate-out')).toBe(true);
                    done();
                }, 10);
            }, 10);
        });
    });
});
