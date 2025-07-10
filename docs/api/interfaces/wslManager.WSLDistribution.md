[VSC WSL Manager API - v0.0.1](../README.md) / [Modules](../modules.md) / [wslManager](../modules/wslManager.md) / WSLDistribution

# Interface: WSLDistribution

[wslManager](../modules/wslManager.md).WSLDistribution

Represents a WSL distribution with its current state and metadata

## Table of contents

### Properties

- [default](wslManager.WSLDistribution.md#default)
- [name](wslManager.WSLDistribution.md#name)
- [state](wslManager.WSLDistribution.md#state)
- [version](wslManager.WSLDistribution.md#version)

## Properties

### default

• **default**: `boolean`

Whether this is the default distribution

#### Defined in

[wslManager.ts:22](https://github.com/sirfifer/vsc-wsl-manager/blob/5b393991c30596f40151a253bb982478cb9feeb0/src/wslManager.ts#L22)

___

### name

• **name**: `string`

The name of the WSL distribution

#### Defined in

[wslManager.ts:16](https://github.com/sirfifer/vsc-wsl-manager/blob/5b393991c30596f40151a253bb982478cb9feeb0/src/wslManager.ts#L16)

___

### state

• **state**: ``"Running"`` \| ``"Stopped"``

Current state of the distribution

#### Defined in

[wslManager.ts:18](https://github.com/sirfifer/vsc-wsl-manager/blob/5b393991c30596f40151a253bb982478cb9feeb0/src/wslManager.ts#L18)

___

### version

• **version**: `string`

WSL version (1 or 2)

#### Defined in

[wslManager.ts:20](https://github.com/sirfifer/vsc-wsl-manager/blob/5b393991c30596f40151a253bb982478cb9feeb0/src/wslManager.ts#L20)
