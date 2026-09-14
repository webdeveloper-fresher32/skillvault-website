# Phase 06: Storage

## What You'll Learn

This phase covers how Kubernetes handles persistent data for stateful applications. You will learn about the different volume types available at the Pod level, how PersistentVolumes and PersistentVolumeClaims decouple storage provisioning from application consumption, and how StorageClasses enable dynamic provisioning through cloud provider APIs. By the end of this phase you will be able to design, provision, and manage storage for any stateful workload running on Kubernetes.

## Learning Objectives

By completing this phase you will be able to:

- Mount ephemeral volumes (emptyDir, configMap, secret, downwardAPI) into Pods
- Explain the difference between a PersistentVolume, a PersistentVolumeClaim, and a StorageClass
- Trace the full PV lifecycle from provisioning through binding, use, release, and reclaim
- Choose the correct access mode (ReadWriteOnce, ReadOnlyMany, ReadWriteMany) for a workload
- Write PVC manifests that request storage with specific size, access mode, and StorageClass
- Create StorageClasses for AWS EBS, GCP Persistent Disk, and other cloud providers
- Understand the difference between Immediate and WaitForFirstConsumer volume binding modes
- Configure the default StorageClass for a cluster

## Topics

| File | Topic | Time |
|------|-------|------|
| [01-Volumes.md](./01-Volumes.md) | Pod volumes — emptyDir, hostPath, configMap, secret, projected, downwardAPI, when to use each | 1 day |
| [02-PersistentVolumes-PVCs.md](./02-PersistentVolumes-PVCs.md) | PV/PVC lifecycle, access modes, reclaim policies, binding, dynamic provisioning | 2 days |
| [03-StorageClasses.md](./03-StorageClasses.md) | StorageClasses, provisioners, parameters, binding modes, cloud storage, default class | 2 days |

## Estimated Time

4 - 5 days

## Previous Phase

[Phase 05 - Services and Networking](../Phase-05-Services-Networking/README.md) — Services, DNS, NetworkPolicies

## Next Phase

[Phase 07 - Configuration and Secrets](../Phase-07-Config-Secrets/README.md) — ConfigMaps, Secrets, environment injection, and configuration management
