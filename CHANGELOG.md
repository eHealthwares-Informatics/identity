# Changelog — identity

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased] - 2026-10-25

### Updated
- Login page/UI updates

---

## [29ce534c] - 2026-10-24

### Updated
- Login page/UI updates

---

## [bd0ba822] - 2026-10-23

### Added
- Auth: capture OAuth profile on Google and Facebook sign-in

---

## [26f64b2f] - 2026-10-22

### CI/CD
- Merged base freshness guard fix (PR #16)

---

## [760bf040] - 2026-10-21

### CI/CD
- Base freshness: check out PR head — merge commit made check unconditional

---

## [e22307d8] - 2026-10-20

### CI/CD
- Merged base freshness guard (PR #15)
- Fail PR whose base is stale (silent-revert guard) — rxsoft-qa#801 / #800

---

## [dc85e0e1] - 2026-10-19

### Added
- Merged provisioner parity (PR #14)

---

## [e22548a2] - 2026-10-18

### Fixed
- Provision: identity's own template grants parents, not `.*` wildcards

---

## [827c0790] - 2026-10-17

### Added
- Provision: bring identity's provisioner to parity with the seed's

---

## [482505d7] - 2026-10-16

### Fixed
- Merged roles PATCH verb fix (PR #11)