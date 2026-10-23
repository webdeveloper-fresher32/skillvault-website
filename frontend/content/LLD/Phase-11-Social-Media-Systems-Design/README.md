# Phase 11 — Social Media & Media-Platform Systems Design

## Overview

Social and media-platform LLD questions — WhatsApp, Spotify, Instagram, an Amazon-style shopping cart — look different on the surface but share a common shape: **many independent entities (users, songs, products) interacting through relationships (chats, playlists, carts) that must support real-time state changes (delivery status, playback state, price/discount changes) and be extended without breaking existing behavior.**

This phase applies the same **7-step design process** used throughout the course to three classic problems. The goal is not to memorize these three designs — it's to internalize the process so you can apply it to *any* social/media/e-commerce LLD prompt an interviewer gives you.

## The 7-Step Design Process

1. **Clarify Requirements** — Pin down functional requirements (what actions the system supports) and non-functional requirements (real-time delivery, scale, consistency). State assumptions out loud instead of guessing silently.
2. **Identify Entities/Classes** — Extract nouns from the requirements and turn them into candidate classes. Separate core domain entities (`Message`, `Song`, `Product`) from orchestrating/manager classes (`Chat`, `Player`, `Cart`).
3. **Define Relationships** — Decide composition vs aggregation vs association, and multiplicities (1:1, 1:N, N:M) between classes — e.g., a `Group` *has-many* `User`s, a `Playlist` *references* `Song`s it doesn't own.
4. **Assign Responsibilities** — Apply Single Responsibility Principle: which class owns which state, and which class owns which behavior? Keep `Chat` from becoming a god-class that also formats notifications and calculates unread counts.
5. **Apply SOLID** — Walk each class/interface through SRP, OCP, LSP, ISP, DIP. This is the step interviewers probe hardest — especially around whether adding a new feature forces you to modify existing classes.
6. **Apply Design Patterns Where Appropriate** — Don't force patterns in; introduce them where they solve real variability. This phase leans heavily on **Observer** (status/event propagation), **State** (lifecycle-dependent behavior), **Iterator** (uniform traversal), and **Strategy** (interchangeable algorithms like discounts).
7. **Explain Extensibility** — Walk through 2-3 "what if we added X" scenarios (voice messages, podcast support, buy-one-get-one discounts) and show the design absorbs them without rewriting core classes — Open/Closed in action.

## Lessons in This Phase

| # | Lesson | Core Design Challenge |
|---|--------|------------------------|
| 01 | [WhatsApp Design](01-WhatsApp-Design.md) | Modeling 1:1 and group chat uniformly; propagating delivery status |
| 02 | [Spotify Design](02-Spotify-Design.md) | Player lifecycle state; uniform traversal over heterogeneous playlists |
| 03 | [Amazon Cart Design](03-Amazon-Cart-Design.md) | Interchangeable discount/coupon rules; cart-to-order-to-payment flow |

## How to Use This Phase

For each lesson: read the requirements, sketch the classes yourself before reading further, *then* compare against the lesson's design. In a live interview you typically have 35-45 minutes total — roughly 5 minutes for step 1, 10 for steps 2-4, 10 for steps 5-6, 5 for step 7, and the remainder for coding a few key methods live.

These lessons focus on *design reasoning* with class skeletons, not full production implementations — the skeletons are detailed enough to extend into working code during a live-coding round.
