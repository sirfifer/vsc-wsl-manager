[VSC WSL Manager API - v0.0.1](../README.md) / [Modules](../modules.md) / [terminalProfileManager](../modules/terminalProfileManager.md) / TerminalProfileManager

# Class: TerminalProfileManager

[terminalProfileManager](../modules/terminalProfileManager.md).TerminalProfileManager

Manages VS Code terminal profiles for WSL distributions

**`Remarks`**

This class automatically creates and manages terminal profiles
for each WSL distribution, allowing users to easily open terminals
in any WSL environment.

**`Example`**

```typescript
const manager = new TerminalProfileManager(context);
await manager.updateTerminalProfiles(distributions);
```

## Table of contents

### Constructors

- [constructor](terminalProfileManager.TerminalProfileManager.md#constructor)

### Methods

- [ensureDefaultProfile](terminalProfileManager.TerminalProfileManager.md#ensuredefaultprofile)
- [removeTerminalProfiles](terminalProfileManager.TerminalProfileManager.md#removeterminalprofiles)
- [updateTerminalProfiles](terminalProfileManager.TerminalProfileManager.md#updateterminalprofiles)

## Constructors

### constructor

• **new TerminalProfileManager**(`context`): [`TerminalProfileManager`](terminalProfileManager.TerminalProfileManager.md)

Creates a new terminal profile manager

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `context` | `ExtensionContext` | VS Code extension context for state persistence |

#### Returns

[`TerminalProfileManager`](terminalProfileManager.TerminalProfileManager.md)

#### Defined in

[terminalProfileManager.ts:27](https://github.com/sirfifer/vsc-wsl-manager/blob/5b393991c30596f40151a253bb982478cb9feeb0/src/terminalProfileManager.ts#L27)

## Methods

### ensureDefaultProfile

▸ **ensureDefaultProfile**(`distributionName`): `Promise`\<`void`\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `distributionName` | `string` |

#### Returns

`Promise`\<`void`\>

#### Defined in

[terminalProfileManager.ts:129](https://github.com/sirfifer/vsc-wsl-manager/blob/5b393991c30596f40151a253bb982478cb9feeb0/src/terminalProfileManager.ts#L129)

___

### removeTerminalProfiles

▸ **removeTerminalProfiles**(): `Promise`\<`void`\>

#### Returns

`Promise`\<`void`\>

#### Defined in

[terminalProfileManager.ts:87](https://github.com/sirfifer/vsc-wsl-manager/blob/5b393991c30596f40151a253bb982478cb9feeb0/src/terminalProfileManager.ts#L87)

___

### updateTerminalProfiles

▸ **updateTerminalProfiles**(`distributions`): `Promise`\<`void`\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `distributions` | [`WSLDistribution`](../interfaces/wslManager.WSLDistribution.md)[] |

#### Returns

`Promise`\<`void`\>

#### Defined in

[terminalProfileManager.ts:29](https://github.com/sirfifer/vsc-wsl-manager/blob/5b393991c30596f40151a253bb982478cb9feeb0/src/terminalProfileManager.ts#L29)
