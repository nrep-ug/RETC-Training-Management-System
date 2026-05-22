# RETC Training Management System

The RETC Training Management System is RETC's internal web platform for operating training programmes end-to-end: maintaining participant, programme, trainer, and partner records; supporting operational analytics and document exports; and enforcing role-based administration for authorised staff. Implemented with Next.js and Appwrite.

## Purpose

This system is designed as an internal data management and analysis tool for RETC staff. It supports structured record-keeping and decision support across programme delivery operations.

## Core scope

- Training programmes management
- Trainee records management
- Trainer and partner records management
- Role-based administration (admin/manager)
- Analytics and reporting exports

## Technology

- Next.js (React frontend)
- Appwrite (authentication and database)

## Appwrite: programs `course` attribute

Each program belongs under the parent category **Renewable energy courses** and must have a `course` field (String or Enum) on the **programs** collection. Allowed keys:

| Key | Label |
|-----|-------|
| `solar_technologies` | Solar Technologies |
| `e_mobility` | E-Mobility |
| `bioenergy_technologies` | Bioenergy Technologies |
| `energy_efficiency` | Energy Efficiency |
| `hydrogen_emerging_tech` | Hydrogen & Emerging Tech |
| `hydro_energy` | Hydro-energy |

Course definitions and filter helpers live in `lib/renewable-energy-courses.js`. Legacy programs without `course` may show as **Uncategorized** or infer a course from the program title until an admin edits and saves them.
