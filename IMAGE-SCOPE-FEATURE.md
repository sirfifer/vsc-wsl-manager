# Image Scope Feature - Project-Specific vs Global Images

## Summary
Successfully implemented project-specific and global scope for WSL images, allowing users to control where their terminal profiles appear.

## Implementation Details

### 1. **Scope Options**
When creating an image (from distro or cloning), users now see:
- **🌍 Global** (default): Available in all projects - Image appears in terminal profiles across all VS Code windows
- **📁 Current Project Only**: Only for this workspace - Image only visible when working in the specific project

### 2. **Default Behavior**
- **Default is Global**: Images are global by default, maintaining expected behavior
- **Backward Compatible**: Existing images without scope are treated as global
- **Inheritance**: Cloned images inherit scope from parent unless explicitly overridden

### 3. **User Experience**

#### Creating an Image:
1. Select source distribution/image
2. Enter name and description
3. **NEW**: Choose scope (Global or Current Project)
4. Image is created with appropriate visibility

#### Terminal Profiles:
- Global images appear in ALL VS Code windows
- Project-specific images ONLY appear when that project is open
- Reduces clutter in terminal dropdown for project-specific environments

#### Tree View:
- 🌍 icon indicates global images
- 📁 icon indicates project-specific images
- Tooltip shows scope details

### 4. **Technical Implementation**

#### ImageMetadata Structure:
```typescript
scope?: {
    type: 'global' | 'workspace';
    workspacePath?: string;  // Path to workspace folder
    workspaceName?: string;  // Display name of workspace
}
```

#### Profile Filtering:
```typescript
const visibleImages = images.filter(img => {
    if (img.enabled === false) return false;

    // Check scope
    if (!img.scope || img.scope.type === 'global') {
        return true;  // Global images always visible
    }

    if (img.scope.type === 'workspace') {
        // Only show if in matching workspace
        return img.scope.workspacePath === currentWorkspace;
    }

    return true;
});
```

## Benefits

### For AI Coding Assistant Users:
- **Project Isolation**: Each project can have its own AI coding environment
- **No Pollution**: Project-specific setups don't clutter other projects
- **Team Collaboration**: Share project-specific images with .vscode settings

### General Benefits:
- **Organized Workspaces**: Relevant images for each project
- **Reduced Clutter**: Terminal dropdown only shows relevant options
- **Flexibility**: Choose global for commonly used images, project for specialized ones

## Files Modified

1. **src/images/WSLImageManager.ts**
   - Added scope to ImageMetadata interface
   - Added scope to CreateFromDistroOptions and CloneImageOptions
   - Save scope in metadata when creating/cloning

2. **src/extension.ts**
   - Added scope picker UI to createImage command
   - Added scope picker UI to createImageFromDistribution command
   - Added scope picker UI to createImageFromImage command

3. **src/terminal/wslTerminalProfileProvider.ts**
   - Filter images based on current workspace
   - Only register profiles for visible images

4. **src/views/ImageTreeProvider.ts**
   - Show scope indicators (🌍/📁) in tree view
   - Include scope info in tooltips

## Testing
- ✅ Compilation successful
- ✅ All tests pass
- ✅ Security validation passes

## Usage Example

### Creating a Project-Specific AI Coding Environment:
1. Open your project in VS Code
2. Run "Create Image from Distribution"
3. Select base distribution (e.g., Ubuntu)
4. Name it (e.g., "myproject-ai-env")
5. Choose "📁 Current Project Only"
6. Image is created and only appears when this project is open

### Creating a Global Development Environment:
1. Run "Create Image from Distribution"
2. Select base distribution
3. Name it (e.g., "general-dev")
4. Choose "🌍 Global" (or just press Enter for default)
5. Image appears in all VS Code windows

## Future Enhancements
- Workspace settings to override image visibility
- Bulk scope management for existing images
- Export/import project-specific image configurations
- Team sharing via workspace settings

This feature perfectly supports the main use case of project-specific AI coding environments while maintaining sensible global defaults.