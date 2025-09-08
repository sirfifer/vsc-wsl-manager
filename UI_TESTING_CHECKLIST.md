# 🧪 Comprehensive UI Testing Checklist

## ✅ READY FOR TESTING

All components have been validated and the extension is ready for comprehensive UI testing in VS Code.

## 📋 Testing Instructions

### 1. Launch Extension
```bash
# Open VS Code in project directory
code .

# Press F5 to launch Extension Development Host
# OR: Run > Start Debugging
```

### 2. Verify Activation
- [ ] Check Debug Console for: "WSL Manager extension is now active!"
- [ ] No error messages in Debug Console
- [ ] No permission errors

### 3. Activity Bar
- [ ] WSL Manager icon appears in Activity Bar
- [ ] Icon is clickable and opens the views

## 🎯 Complete UI Testing Checklist

### A. Tree Views Display

#### Distributions View (Pristine Templates)
- [ ] View titled "WSL Distributions" is visible
- [ ] Empty state shows welcome message:
  - [ ] "No WSL distributions found"
  - [ ] Link to "Download Distribution"
  - [ ] Link to "Import from TAR"
  - [ ] Link to "Learn about WSL"
- [ ] Refresh button (↻) in view title bar
- [ ] Download button (☁) in view title bar

#### Images View (Working Instances)
- [ ] View titled "WSL Images" is visible
- [ ] Empty state shows welcome message:
  - [ ] "No WSL images found"
  - [ ] Link to "Create Image from Distribution"
  - [ ] Link to "Create Image from Existing Image"
  - [ ] Link to "Learn about WSL Images"
- [ ] Create from distro button (+) in view title bar
- [ ] Clone image button (⤴) in view title bar
- [ ] Refresh button (↻) in view title bar

### B. Command Palette (Ctrl+Shift+P)

Test each command appears and is executable:

#### Distro Commands
- [ ] "WSL: Refresh Distributions"
- [ ] "WSL: Download Distribution"
- [ ] "WSL: Import Distribution from TAR"

#### Image Commands
- [ ] "WSL: Refresh Images"
- [ ] "WSL: Create Distribution from Image"
- [ ] "WSL: Create Image from Distribution"
- [ ] "WSL: Create Image from Existing Image"
- [ ] "WSL: Delete Distribution"
- [ ] "WSL: Export Distribution to TAR"

#### Image Management
- [ ] "WSL: Edit Image Properties"
- [ ] "WSL: Toggle Image Enabled"

#### Terminal
- [ ] "WSL: Open Terminal"

#### Help
- [ ] "WSL: Learn about WSL"
- [ ] "WSL: Learn about WSL Images"

### C. Download Distribution Workflow

1. **Start Download**
   - [ ] Click download button (☁) in Distributions view
   - [ ] OR: Run "WSL: Download Distribution" command

2. **Distribution Selection**
   - [ ] Quick pick shows available distributions:
     - [ ] Ubuntu 22.04 LTS
     - [ ] Ubuntu 24.04 LTS
     - [ ] Debian 12
     - [ ] Alpine Linux 3.19 (smallest - 3MB)
     - [ ] Fedora 39
     - [ ] Arch Linux
   - [ ] Each item shows version and description

3. **Download Progress**
   - [ ] Progress notification appears
   - [ ] Shows percentage complete
   - [ ] Shows downloaded/total size
   - [ ] Can be cancelled

4. **Completion**
   - [ ] Success notification shown
   - [ ] Distribution appears in tree view
   - [ ] Icon changes from cloud (☁) to package (📦)
   - [ ] Shows as "✓ Downloaded"

### D. Create Image from Distro Workflow

1. **Initiate Creation**
   - [ ] Select downloaded distro in tree
   - [ ] Click "Create Distribution" button
   - [ ] OR: Run command

2. **Name Input**
   - [ ] Prompt for image name appears
   - [ ] Validation prevents invalid characters
   - [ ] Error shown for spaces/special chars
   - [ ] Accepts valid names (letters, numbers, hyphens)

3. **Description Input**
   - [ ] Optional description prompt
   - [ ] Can skip with Enter

4. **Creation Progress**
   - [ ] Progress notification: "Creating WSL instance: {name}"
   - [ ] Shows "Importing distribution..."
   - [ ] Completes with "Complete!"

5. **Result**
   - [ ] New image appears in Images view
   - [ ] Shows source distro in description
   - [ ] Terminal profile enabled by default
   - [ ] Success notification shown

### E. Clone Image Workflow

1. **Select Source**
   - [ ] Right-click image in tree → "Create Image"
   - [ ] OR: Run "WSL: Create Image" command
   - [ ] Shows list of existing images

2. **Clone Name**
   - [ ] Suggests "{source}-clone" as default
   - [ ] Validates name uniqueness
   - [ ] Accepts valid name

3. **Clone Process**
   - [ ] Progress: "Cloning WSL instance: {name}"
   - [ ] Shows "Exporting source..."
   - [ ] Completes successfully

4. **Result**
   - [ ] Cloned image appears in tree
   - [ ] Shows "cloned from {source}" in description
   - [ ] Manifest tracks lineage

### F. Image Properties Management

1. **Edit Properties**
   - [ ] Right-click image → "Edit Image Properties"
   - [ ] OR: Run command and select image

2. **Property Editing**
   - [ ] Display name input (current value shown)
   - [ ] Description input (current value shown)
   - [ ] Enable/Disable terminal profile choice
   - [ ] Changes saved successfully

3. **Toggle Terminal Profile**
   - [ ] Right-click → "Toggle Image Enabled"
   - [ ] Icon changes (eye open/closed)
   - [ ] Terminal profile added/removed
   - [ ] Status notification shown

### G. Terminal Integration

1. **Open Terminal**
   - [ ] Click on image in tree (if enabled)
   - [ ] OR: Right-click → "Open Terminal"
   - [ ] OR: Run command and select image

2. **Terminal Behavior**
   - [ ] Terminal opens with "WSL: {image-name}"
   - [ ] Connects to correct WSL instance
   - [ ] Working directory is correct
   - [ ] Can run Linux commands

3. **Terminal Profiles**
   - [ ] Enabled images appear in terminal dropdown
   - [ ] Disabled images don't appear
   - [ ] Profile names match image display names

### H. Delete Image Workflow

1. **Initiate Deletion**
   - [ ] Right-click image → "Delete Distribution"
   - [ ] OR: Run command and select image

2. **Confirmation**
   - [ ] Modal warning appears
   - [ ] Shows: "Are you sure you want to delete WSL instance '{name}'?"
   - [ ] States: "This action cannot be undone"
   - [ ] Requires clicking "Delete" to confirm

3. **Deletion Process**
   - [ ] Progress notification shown
   - [ ] Image removed from tree
   - [ ] Terminal profile removed
   - [ ] Success notification

### I. Import/Export TAR Files

1. **Import Distribution**
   - [ ] Run "WSL: Import Distribution from TAR"
   - [ ] File picker opens
   - [ ] Filters for .tar, .tar.gz, .tgz files
   - [ ] Prompts for name and description
   - [ ] Imports successfully

2. **Export Distribution**
   - [ ] Run "WSL: Export Distribution to TAR"
   - [ ] Select image to export
   - [ ] Save dialog appears
   - [ ] Exports to chosen location
   - [ ] Progress shown during export

### J. Error Scenarios

Test error handling for:

1. **Invalid Names**
   - [ ] Space in name: "my distro" → Error shown
   - [ ] Special chars: "my@distro" → Error shown
   - [ ] Too long name → Error shown
   - [ ] Empty name → Error shown

2. **Duplicate Names**
   - [ ] Creating image with existing name → Error
   - [ ] Cloning to existing name → Error

3. **Missing Prerequisites**
   - [ ] Create from non-downloaded distro → Warning
   - [ ] Clone non-existent image → Error

4. **WSL Not Available**
   - [ ] Graceful error if WSL not installed
   - [ ] User-friendly message with help link

### K. Help System

1. **WSL Help**
   - [ ] "Learn about WSL" opens Microsoft docs
   - [ ] Link works from welcome view
   - [ ] Link works from command

2. **Image Help**
   - [ ] "Learn about WSL Images" shows modal
   - [ ] Explains Two-World architecture
   - [ ] Describes distros vs images
   - [ ] Lists benefits

### L. Visual Indicators

1. **Distro Tree Items**
   - [ ] Downloaded: Package icon (📦)
   - [ ] Not downloaded: Cloud icon (☁)
   - [ ] Shows version in description
   - [ ] Shows size when not downloaded
   - [ ] Shows ✓ when downloaded

2. **Image Tree Items**
   - [ ] Enabled: VM icon (🖥️)
   - [ ] Disabled: Eye-closed icon (👁️‍🗨️)
   - [ ] Shows source (from distro/cloned)
   - [ ] Shows state if running
   - [ ] Click opens terminal (if enabled)

### M. Performance

1. **Responsiveness**
   - [ ] Views refresh quickly (< 1 second)
   - [ ] Commands respond immediately
   - [ ] No UI freezing during operations
   - [ ] Progress shown for long operations

2. **Resource Usage**
   - [ ] Extension doesn't slow VS Code
   - [ ] Memory usage reasonable
   - [ ] No memory leaks after operations

## 🎯 Complete Workflow Test

### Scenario: Setup Development Environment

1. **Download Alpine Linux** (smallest, 3MB)
   - [ ] Download completes quickly
   - [ ] Shows in distro tree

2. **Create Base Image**
   - [ ] Name: "alpine-base"
   - [ ] Description: "Base Alpine environment"
   - [ ] Creation successful

3. **Clone for Projects**
   - [ ] Clone to "project-a"
   - [ ] Clone to "project-b"
   - [ ] Both appear in tree

4. **Manage Images**
   - [ ] Edit "project-a" display name
   - [ ] Disable "alpine-base" terminal
   - [ ] Open terminal to "project-a"

5. **Cleanup**
   - [ ] Delete "project-b"
   - [ ] Confirmation works
   - [ ] Image removed

## ✅ Validation Complete

Once all items are checked:
- Extension is fully tested
- All UI elements verified
- All workflows validated
- Error handling confirmed
- Ready for production use

## 📝 Notes

- Test with different WSL configurations
- Try with/without existing WSL distributions
- Verify on Windows 10 and Windows 11
- Check with WSL 1 and WSL 2

## 🐛 Issue Reporting

If any issues found:
1. Check Debug Console for errors
2. Note exact steps to reproduce
3. Include error messages
4. Check if issue is consistent