# StudentAttendanceBNR2026

ระบบเช็คชื่อนักเรียนแบบ static web app ใช้ GitHub Pages คู่กับ Firebase Realtime Database

## โครงสร้าง

- `index.html` เป็น markup หลัก
- `styles.css` เป็น style ทั้งหมด
- `js/config.js` เก็บ Firebase config ฝั่ง client
- `js/firebase.js` init Firebase SDK
- `js/store.js` data access layer สำหรับ Realtime Database
- `js/ui.js` render หน้าจอและ escape HTML
- `js/app.js` controller หลักและ event binding
- `firebase.rules.json` rules ตัวอย่างสำหรับ Realtime Database

## Security Setup

ห้ามตั้ง Realtime Database Rules เป็น `.read: true` และ `.write: true` เมื่อเริ่มใช้จริง

ให้ทำแบบนี้แทน:

1. เปิด Firebase Console
2. ไปที่ Authentication
3. เปิด Sign-in method แบบ Email/Password
4. สร้าง user ให้ครูแต่ละคนใน Authentication > Users
5. ตั้ง role ให้ user แต่ละคนใน Realtime Database
6. ไปที่ Realtime Database > Rules
7. วาง rules จาก `firebase.rules.json`
8. กด Publish

## Roles

ระบบมี 2 role:

- `admin` คือครูหลัก เพิ่มห้อง เพิ่มนักเรียน และนำนักเรียนออกได้
- `teacher` คือครูทั่วไป เช็คชื่อและดูประวัติ/สถิติได้ แต่แก้โครงสร้างห้องหรือนักเรียนไม่ได้

หลังสร้าง user ใน Authentication แล้ว ให้ copy `User UID` ไปเพิ่มใน Realtime Database:

```json
{
  "schools": {
    "bnr2026": {
      "users": {
        "PASTE_ADMIN_UID_HERE": {
          "role": "admin",
          "displayName": "ครูหลัก"
        },
        "PASTE_TEACHER_UID_HERE": {
          "role": "teacher",
          "displayName": "ครูประจำวิชา"
        }
      }
    }
  }
}
```

ถ้า user ไม่มี record ใน `users/{uid}` ระบบจะถือว่าเป็น `teacher` ในหน้าเว็บ แต่ Database Rules จะไม่ให้เขียน role หรือแก้ห้อง/นักเรียน

Rules ปัจจุบันแยกสิทธิ์ดังนี้:

```json
{
  "rules": {
    "schools": {
      "bnr2026": {
        "classes": {
          ".read": "auth != null"
        }
      }
    }
  }
}
```

รายละเอียด rules เต็มอยู่ใน `firebase.rules.json`

## Data Model

ข้อมูลถูกแยกเป็นระดับโรงเรียนและห้องเรียน:

```text
schools/bnr2026/classes/{classId}/students/{studentId}
schools/bnr2026/classes/{classId}/attendance/{yyyy-mm-dd}/{studentId}
```

ทำให้ขยายเป็นหลายห้องและหลายครูได้โดยยังใช้ Firebase project เดิม

## Deploy บน GitHub Pages

1. Push ไฟล์ทั้งหมดขึ้น GitHub
2. ไปที่ repository Settings > Pages
3. Source เลือก `Deploy from a branch`
4. Branch เลือก `main` และ folder เลือก `/root`
5. รอ GitHub Pages deploy แล้วเปิด URL ที่ GitHub ให้มา

## หมายเหตุ

Firebase `apiKey` ในเว็บ client ไม่ใช่ secret แบบ server key แต่ security ต้องอยู่ที่ Authentication และ Database Rules
