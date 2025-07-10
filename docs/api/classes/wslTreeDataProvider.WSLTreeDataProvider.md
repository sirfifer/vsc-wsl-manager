[VSC WSL Manager API - v0.0.1](../README.md) / [Modules](../modules.md) / [wslTreeDataProvider](../modules/wslTreeDataProvider.md) / WSLTreeDataProvider

# Class: WSLTreeDataProvider

[wslTreeDataProvider](../modules/wslTreeDataProvider.md).WSLTreeDataProvider

Tree data provider for displaying WSL distributions in VS Code's tree view

**`Example`**

```typescript
const provider = new WSLTreeDataProvider(wslManager);
vscode.window.createTreeView('wslDistributions', { treeDataProvider: provider });
```

## Implements

- `TreeDataProvider`\<`WSLTreeItem`\>

## Table of contents

### Constructors

- [constructor](wslTreeDataProvider.WSLTreeDataProvider.md#constructor)

### Properties

- [onDidChangeTreeData](wslTreeDataProvider.WSLTreeDataProvider.md#ondidchangetreedata)

### Methods

- [getChildren](wslTreeDataProvider.WSLTreeDataProvider.md#getchildren)
- [getTreeItem](wslTreeDataProvider.WSLTreeDataProvider.md#gettreeitem)
- [refresh](wslTreeDataProvider.WSLTreeDataProvider.md#refresh)

## Constructors

### constructor

• **new WSLTreeDataProvider**(`wslManager`): [`WSLTreeDataProvider`](wslTreeDataProvider.WSLTreeDataProvider.md)

Creates a new WSL tree data provider

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `wslManager` | [`WSLManager`](wslManager.WSLManager.md) | WSL manager instance for retrieving distribution data |

#### Returns

[`WSLTreeDataProvider`](wslTreeDataProvider.WSLTreeDataProvider.md)

#### Defined in

[wslTreeDataProvider.ts:23](https://github.com/sirfifer/vsc-wsl-manager/blob/5b393991c30596f40151a253bb982478cb9feeb0/src/wslTreeDataProvider.ts#L23)

## Properties

### onDidChangeTreeData

• `Readonly` **onDidChangeTreeData**: `Event`\<`undefined` \| ``null`` \| `void` \| `WSLTreeItem`\>

Event fired when tree data changes

#### Implementation of

vscode.TreeDataProvider.onDidChangeTreeData

#### Defined in

[wslTreeDataProvider.ts:17](https://github.com/sirfifer/vsc-wsl-manager/blob/5b393991c30596f40151a253bb982478cb9feeb0/src/wslTreeDataProvider.ts#L17)

## Methods

### getChildren

▸ **getChildren**(`element?`): `Promise`\<`WSLTreeItem`[]\>

Gets child elements for a tree item

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `element?` | `WSLTreeItem` | Parent element, or undefined for root level |

#### Returns

`Promise`\<`WSLTreeItem`[]\>

Promise resolving to array of child tree items

**`Remarks`**

- When element is undefined, returns list of distributions
- When element is a distribution, returns distribution details

#### Implementation of

vscode.TreeDataProvider.getChildren

#### Defined in

[wslTreeDataProvider.ts:57](https://github.com/sirfifer/vsc-wsl-manager/blob/5b393991c30596f40151a253bb982478cb9feeb0/src/wslTreeDataProvider.ts#L57)

___

### getTreeItem

▸ **getTreeItem**(`element`): `TreeItem`

Gets the tree item representation for display

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `element` | `WSLTreeItem` | The tree item to display |

#### Returns

`TreeItem`

The tree item for VS Code to render

#### Implementation of

vscode.TreeDataProvider.getTreeItem

#### Defined in

[wslTreeDataProvider.ts:43](https://github.com/sirfifer/vsc-wsl-manager/blob/5b393991c30596f40151a253bb982478cb9feeb0/src/wslTreeDataProvider.ts#L43)

___

### refresh

▸ **refresh**(): `void`

Refreshes the tree view by firing the change event

#### Returns

`void`

**`Example`**

```typescript
provider.refresh(); // Updates the tree view
```

#### Defined in

[wslTreeDataProvider.ts:33](https://github.com/sirfifer/vsc-wsl-manager/blob/5b393991c30596f40151a253bb982478cb9feeb0/src/wslTreeDataProvider.ts#L33)
