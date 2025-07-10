[VSC WSL Manager API - v0.0.1](../README.md) / [Modules](../modules.md) / extension

# Module: extension

## Table of contents

### Functions

- [activate](extension.md#activate)
- [deactivate](extension.md#deactivate)

## Functions

### activate

▸ **activate**(`context`): `void`

Activates the WSL Manager extension

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `context` | `ExtensionContext` | VS Code extension context |

#### Returns

`void`

**`Remarks`**

This function is called when the extension is activated.
It initializes all managers, registers commands, and sets up the tree view.

#### Defined in

[extension.ts:17](https://github.com/sirfifer/vsc-wsl-manager/blob/5b393991c30596f40151a253bb982478cb9feeb0/src/extension.ts#L17)

___

### deactivate

▸ **deactivate**(): `void`

Deactivates the WSL Manager extension

#### Returns

`void`

**`Remarks`**

This function is called when the extension is deactivated.
Cleanup is handled automatically by VS Code disposing subscriptions.

#### Defined in

[extension.ts:236](https://github.com/sirfifer/vsc-wsl-manager/blob/5b393991c30596f40151a253bb982478cb9feeb0/src/extension.ts#L236)
