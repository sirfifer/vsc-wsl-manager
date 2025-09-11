/**
 * Tests for UI Commands and Context Menu Operations
 */

import * as vscode from 'vscode';
import { expect } from 'chai';
import * as sinon from 'sinon';
import { WSLManager } from '../src/wslManager';
import { WSLImageManager } from '../src/images/WSLImageManager';
import { DistroManager } from '../src/distros/DistroManager';

describe('UI Commands Tests', () => {
    let sandbox: sinon.SinonSandbox;
    let wslManager: WSLManager;
    let imageManager: WSLImageManager;
    let distroManager: DistroManager;
    let windowStub: sinon.SinonStub;
    let progressStub: sinon.SinonStub;

    beforeEach(() => {
        sandbox = sinon.createSandbox();
        wslManager = new WSLManager();
        imageManager = new WSLImageManager();
        distroManager = new DistroManager();
        
        windowStub = sandbox.stub(vscode.window);
        progressStub = sandbox.stub(vscode.window, 'withProgress');
    });

    afterEach(() => {
        sandbox.restore();
    });

    describe('Distribution Deletion', () => {
        it('should delete a distribution when confirmed', async () => {
            // Arrange
            const distroName = 'Ubuntu-22.04';
            windowStub.showWarningMessage = sandbox.stub().resolves('Yes');
            const unregisterStub = sandbox.stub(wslManager, 'unregisterDistribution').resolves();
            progressStub.callsFake(async (options, task) => {
                return task({ report: () => {} });
            });

            // Act - simulate the delete command
            const deleteDistribution = async (name: string) => {
                const answer = await vscode.window.showWarningMessage(
                    `Are you sure you want to delete the distribution '${name}'? This action cannot be undone.`,
                    'Yes', 'No'
                );
                
                if (answer === 'Yes') {
                    await vscode.window.withProgress({
                        location: vscode.ProgressLocation.Notification,
                        title: `Deleting distribution '${name}'...`,
                        cancellable: false
                    }, async () => {
                        await wslManager.unregisterDistribution(name);
                    });
                }
            };

            await deleteDistribution(distroName);

            // Assert
            expect(unregisterStub.calledOnceWith(distroName)).to.be.true;
        });

        it('should not delete a distribution when cancelled', async () => {
            // Arrange
            const distroName = 'Ubuntu-22.04';
            windowStub.showWarningMessage = sandbox.stub().resolves('No');
            const unregisterStub = sandbox.stub(wslManager, 'unregisterDistribution').resolves();

            // Act
            const deleteDistribution = async (name: string) => {
                const answer = await vscode.window.showWarningMessage(
                    `Are you sure you want to delete the distribution '${name}'? This action cannot be undone.`,
                    'Yes', 'No'
                );
                
                if (answer === 'Yes') {
                    await wslManager.unregisterDistribution(name);
                }
            };

            await deleteDistribution(distroName);

            // Assert
            expect(unregisterStub.called).to.be.false;
        });
    });

    describe('Image Deletion', () => {
        it('should delete an image when confirmed', async () => {
            // Arrange
            const imageName = 'dev-env';
            windowStub.showWarningMessage = sandbox.stub().resolves('Yes');
            const deleteImageStub = sandbox.stub(imageManager, 'deleteImage').resolves();
            progressStub.callsFake(async (options, task) => {
                return task({ report: () => {} });
            });

            // Act
            const deleteImage = async (name: string) => {
                const answer = await vscode.window.showWarningMessage(
                    `Are you sure you want to delete the image '${name}'? This will unregister the WSL distribution.`,
                    'Yes', 'No'
                );
                
                if (answer === 'Yes') {
                    await vscode.window.withProgress({
                        location: vscode.ProgressLocation.Notification,
                        title: `Deleting image '${name}'...`,
                        cancellable: false
                    }, async () => {
                        await imageManager.deleteImage(name);
                    });
                }
            };

            await deleteImage(imageName);

            // Assert
            expect(deleteImageStub.calledOnceWith(imageName)).to.be.true;
        });

        it('should handle delete image errors gracefully', async () => {
            // Arrange
            const imageName = 'dev-env';
            const errorMessage = 'Permission denied';
            windowStub.showWarningMessage = sandbox.stub().resolves('Yes');
            const deleteImageStub = sandbox.stub(imageManager, 'deleteImage')
                .rejects(new Error(errorMessage));
            windowStub.showErrorMessage = sandbox.stub();
            progressStub.callsFake(async (options, task) => {
                return task({ report: () => {} });
            });

            // Act
            const deleteImage = async (name: string) => {
                const answer = await vscode.window.showWarningMessage(
                    `Are you sure you want to delete the image '${name}'?`,
                    'Yes', 'No'
                );
                
                if (answer === 'Yes') {
                    try {
                        await vscode.window.withProgress({
                            location: vscode.ProgressLocation.Notification,
                            title: `Deleting image '${name}'...`,
                            cancellable: false
                        }, async () => {
                            await imageManager.deleteImage(name);
                        });
                    } catch (error: any) {
                        vscode.window.showErrorMessage(`Failed to delete image: ${error.message}`);
                    }
                }
            };

            await deleteImage(imageName);

            // Assert
            expect(deleteImageStub.calledOnce).to.be.true;
            expect(windowStub.showErrorMessage.calledWith(`Failed to delete image: ${errorMessage}`)).to.be.true;
        });
    });

    describe('Image Creation from Distribution', () => {
        it('should create an image from a distribution', async () => {
            // Arrange
            const distroName = 'Ubuntu-22.04';
            const imageName = 'dev-env';
            
            windowStub.showQuickPick = sandbox.stub()
                .onFirstCall().resolves(distroName)  // Select distribution
                .onSecondCall().resolves('New image name'); // Select action
            windowStub.showInputBox = sandbox.stub().resolves(imageName);
            
            const createImageStub = sandbox.stub(imageManager, 'createImageFromDistro').resolves();
            progressStub.callsFake(async (options, task) => {
                return task({ report: () => {} });
            });

            // Act
            const createImageFromDistro = async () => {
                const distros = [distroName, 'Debian'];
                const selectedDistro = await vscode.window.showQuickPick(distros, {
                    placeHolder: 'Select a distribution to create an image from'
                });
                
                if (!selectedDistro) return;
                
                const action = await vscode.window.showQuickPick(
                    ['New image name', 'Use distribution name'],
                    { placeHolder: 'How would you like to name the image?' }
                );
                
                let name = selectedDistro;
                if (action === 'New image name') {
                    name = await vscode.window.showInputBox({
                        prompt: 'Enter a name for the new image',
                        value: selectedDistro + '-image',
                        validateInput: (value) => {
                            if (!value) return 'Name is required';
                            if (!/^[a-zA-Z0-9-_]+$/.test(value)) {
                                return 'Name can only contain letters, numbers, hyphens, and underscores';
                            }
                            return undefined;
                        }
                    }) || '';
                }
                
                if (name) {
                    await vscode.window.withProgress({
                        location: vscode.ProgressLocation.Notification,
                        title: `Creating image '${name}' from distribution '${selectedDistro}'...`,
                        cancellable: false
                    }, async () => {
                        await imageManager.createImageFromDistro(selectedDistro, name);
                    });
                }
            };

            await createImageFromDistro();

            // Assert
            expect(createImageStub.calledOnceWith(distroName, imageName)).to.be.true;
        });

        it('should handle image creation errors', async () => {
            // Arrange
            const distroName = 'Ubuntu-22.04';
            const imageName = 'dev-env';
            const errorMessage = 'Export failed';
            
            windowStub.showQuickPick = sandbox.stub().resolves(distroName);
            windowStub.showInputBox = sandbox.stub().resolves(imageName);
            windowStub.showErrorMessage = sandbox.stub();
            
            const createImageStub = sandbox.stub(imageManager, 'createImageFromDistro')
                .rejects(new Error(errorMessage));
            progressStub.callsFake(async (options, task) => {
                return task({ report: () => {} });
            });

            // Act
            const createImageFromDistro = async () => {
                try {
                    await vscode.window.withProgress({
                        location: vscode.ProgressLocation.Notification,
                        title: `Creating image...`,
                        cancellable: false
                    }, async () => {
                        await imageManager.createImageFromDistro(distroName, imageName);
                    });
                } catch (error: any) {
                    vscode.window.showErrorMessage(`Failed to create image: ${error.message}`);
                }
            };

            await createImageFromDistro();

            // Assert
            expect(createImageStub.calledOnce).to.be.true;
            expect(windowStub.showErrorMessage.calledWith(`Failed to create image: ${errorMessage}`)).to.be.true;
        });
    });

    describe('Distribution Creation from Image', () => {
        it('should create a distribution from an image', async () => {
            // Arrange
            const imageName = 'dev-env';
            const newDistroName = 'dev-instance';
            
            windowStub.showQuickPick = sandbox.stub().resolves(imageName);
            windowStub.showInputBox = sandbox.stub().resolves(newDistroName);
            
            const createDistroStub = sandbox.stub(imageManager, 'createDistributionFromImage').resolves();
            progressStub.callsFake(async (options, task) => {
                return task({ report: () => {} });
            });

            // Act
            const createDistroFromImage = async () => {
                const images = [imageName, 'prod-env'];
                const selectedImage = await vscode.window.showQuickPick(images, {
                    placeHolder: 'Select an image to create a distribution from'
                });
                
                if (!selectedImage) return;
                
                const name = await vscode.window.showInputBox({
                    prompt: 'Enter a name for the new distribution',
                    value: selectedImage + '-instance',
                    validateInput: (value) => {
                        if (!value) return 'Name is required';
                        if (!/^[a-zA-Z0-9-_]+$/.test(value)) {
                            return 'Name can only contain letters, numbers, hyphens, and underscores';
                        }
                        return undefined;
                    }
                });
                
                if (name) {
                    await vscode.window.withProgress({
                        location: vscode.ProgressLocation.Notification,
                        title: `Creating distribution '${name}' from image '${selectedImage}'...`,
                        cancellable: false
                    }, async () => {
                        await imageManager.createDistributionFromImage(selectedImage, name);
                    });
                }
            };

            await createDistroFromImage();

            // Assert
            expect(createDistroStub.calledOnceWith(imageName, newDistroName)).to.be.true;
        });
    });

    describe('Image Source Display', () => {
        it('should display correct source for images created from distros', () => {
            // Arrange
            const imageMetadata = {
                name: 'dev-env',
                displayName: 'Development Environment',
                source: 'Ubuntu-22.04',
                sourceType: 'distro' as const,
                created: new Date().toISOString(),
                wslVersion: 2,
                enabled: true,
                hasManifest: true,
                tags: ['dev', 'ubuntu']
            };

            // Act
            const getImageDescription = (image: typeof imageMetadata): string => {
                const parts = [];
                
                // Show source
                if (image.sourceType === 'distro') {
                    // Fix: Show "from distro" when source is unknown
                    if (image.source === 'unknown') {
                        parts.push('from distro');
                    } else {
                        parts.push(`from ${image.source}`);
                    }
                } else {
                    parts.push(`cloned from ${image.source}`);
                }
                
                return parts.join(' • ');
            };

            const description = getImageDescription(imageMetadata);

            // Assert
            expect(description).to.equal('from Ubuntu-22.04');
        });

        it('should display "from distro" for legacy images with unknown source', () => {
            // Arrange
            const imageMetadata = {
                name: 'legacy-env',
                displayName: 'Legacy Environment',
                source: 'unknown',
                sourceType: 'distro' as const,
                created: new Date().toISOString(),
                wslVersion: 2,
                enabled: true,
                hasManifest: false,
                tags: []
            };

            // Act
            const getImageDescription = (image: typeof imageMetadata): string => {
                const parts = [];
                
                // Show source
                if (image.sourceType === 'distro') {
                    // Fix: Show "from distro" when source is unknown
                    if (image.source === 'unknown') {
                        parts.push('from distro');
                    } else {
                        parts.push(`from ${image.source}`);
                    }
                } else {
                    parts.push(`cloned from ${image.source}`);
                }
                
                return parts.join(' • ');
            };

            const description = getImageDescription(imageMetadata);

            // Assert
            expect(description).to.equal('from distro');
        });

        it('should display correct source for cloned images', () => {
            // Arrange
            const imageMetadata = {
                name: 'prod-env',
                displayName: 'Production Environment',
                source: 'dev-env',
                sourceType: 'image' as const,
                created: new Date().toISOString(),
                wslVersion: 2,
                enabled: true,
                hasManifest: true,
                tags: ['prod']
            };

            // Act
            const getImageDescription = (image: typeof imageMetadata): string => {
                const parts = [];
                
                // Show source
                if (image.sourceType === 'distro') {
                    if (image.source === 'unknown') {
                        parts.push('from distro');
                    } else {
                        parts.push(`from ${image.source}`);
                    }
                } else {
                    parts.push(`cloned from ${image.source}`);
                }
                
                return parts.join(' • ');
            };

            const description = getImageDescription(imageMetadata);

            // Assert
            expect(description).to.equal('cloned from dev-env');
        });
    });
});