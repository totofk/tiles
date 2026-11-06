# Product Requirement Document (PRD)

**Project Title:** Incremental Farm Automator  
**Genre:** 2D Incremental / Idle / Management Strategy  
**Target Platform:** PC / Web Browser / Mobile  
**Document Version:** 1.0  

---

## 1. Executive Summary & Core Concept

**Incremental Farm Automator** คือเกมแนวบริหารจัดการฟาร์มที่ผสมผสานกลไกของ Incremental / Idle Strategy โดยผู้เล่นเริ่มต้นจากแปลงเกษตรขนาดเล็กที่ต้องลงมือทำทุกอย่างด้วยตัวเอง (Manual) และค่อยๆ ลงทุนขยายพื้นที่ จ้างแรงงาน ซื้อเครื่องจักร เพื่อยกระดับสู่ **ระบบอุตสาหกรรมเกษตรอัตโนมัติ (Automated Farm System)** 100%

### Core Gameplay Loop
$$\text{เลือกพืช/ปลูก} \rightarrow \text{ดูแล/เก็บเกี่ยว} \rightarrow \text{ขายผลผลิต} \rightarrow \text{ลงทุนซื้อ License / เครื่องจักร / จ้างคน} \rightarrow \text{ระบบทำงานอัตโนมัติ (Idle)}$$

---

## 2. Target Audience & Pillars

### Game Pillars
1. **Satisfying Progression Curve:** สัมผัสความสำเร็จจากการเปลี่ยนผ่านจากงานใช้แรงงาน สู่การควบคุมระบบจักรกลอุตสาหกรรม
2. **Resource & Logistics Balance:** บริหารค่าใช้จ่ายแฝง (Maintenance & Labor) ให้เหมาะสมเพื่อป้องกันสภาวะเงินติดลบ
3. **Risk vs. Reward Management:** บริหารระยะเวลาเก็บเกี่ยวและการผันผวนของราคาตลาด

---

## 3. Core Mechanics & Gameplay Systems

### 3.1 Initial State & Basic Cycle (Early Game)
* **Starting State:** แปลงเกษตรเริ่มต้น 6 บล็อก + เงินทุนสำรองเริ่มต้นก้อนหนึ่ง
* **Manual Actions:** ผู้เล่นใช้ค่าพลังงานประจำวัน (Daily Energy) ในการกดทำแอ็กชัน:
  * พรวนดิน (Till Soil)
  * ลงเมล็ด (Plant Seed)
  * รดน้ำ (Watering)
  * เก็บเกี่ยว (Harvest)
* **Daily Energy System:** ค่าพลังงานจำกัดต่อวัน เมื่อพลังงานหมดต้องข้ามวันใหม่เพื่อฟื้นฟู

### 3.2 License Progression System
* ผู้เล่นไม่สามารถปลูกพืชทุกชนิดได้ตั้งแต่เริ่ม
* ต้องสะสมเงินทุนเพื่อซื้อ **Crop Licenses** สำหรับปลดล็อกพืชที่มีมูลค่าสูงขึ้นและใช้เวลาเติบโตนานขึ้น

### 3.3 Labor & Machinery Automation (Mid to Late Game)
* **Labor (จ้างงานมนุษย์):**
  * แบ่งสายการทำงาน: คนพรวนดิน, คนหว่านเมล็ด, คนรดน้ำ, คนเก็บเกี่ยว
  * คิดค่าตอบแทนเป็นค่าจ้างรายวัน (Daily Wages)
* **Machinery (เครื่องจักรระบบอุตสาหกรรม):**
  * สปริงเกอร์รดน้ำอัตโนมัติ, รถพรวนดิน, รถปลูก, เครื่องเก็บเกี่ยวอุตสาหกรรม
  * คิดค่าบำรุงรักษาตามระดับ Tier (Daily Maintenance Costs)
* **Automation Progression:**
  * **Phase 1 (Manual):** ทำเอง 100%
  * **Phase 2 (Semi-Auto):** ใช้สปริงเกอร์ + จ้างคนเก็บเกี่ยว
  * **Phase 3 (Full Auto - Idle):** ใช้รถไถอุตสาหกรรม + ระบบจัดส่งอัตโนมัติ 100%

### 3.4 Risk & Operational Costs
1. **ระบบผลผลิตเน่าเสีย (Rot & Expiration System):**
   * **On-Field Decay:** พืชที่โตเต็มที่แล้วแต่ไม่เก็บเกี่ยวภายในระยะเวลาที่กำหนด จะเน่าเสียบนแปลง (เสียฟรี)
   * **Inventory Spoilage:** ผลผลิตที่เก็บเข้าคลังแล้ว หากไม่ขายออกภายในระยะเวลาที่กำหนดจะบูดเน่าจนมีมูลค่าเป็น 0
2. **Operational Costs (ค่าใช้จ่ายแฝง):**
   * หักค่าจ้างคนงาน + ค่าซ่อมบำรุงเครื่องจักรทุกๆ การสรุปผลรอบวัน

---

## 4. Game Balance & Dynamic Systems

### 4.1 Anti-Bankruptcy Protection (Negative Spiral Safety Net)
เพื่อป้องกันไม่ให้ผู้เล่นติดหล่มสภาวะเงินติดลบจน Soft-lock เล่นต่อไม่ได้:
* **Emergency Power Off:** หากเงินในคลังติดลบ ระบบจะสั่งหยุดการทำงานของเครื่องจักรและเลิกจ้างคนงานชั่วคราวอัตโนมัติทันที เพื่อหยุดการหักค่าใช้จ่าย และบีบให้ผู้เล่นกลับมาทำ Manual ชั่วคราวเพื่อหาทุนตั้งตัว
* **Emergency Micro-Loan:** ระบบกู้เงินฉุกเฉินก้อนเล็กพร้อมดอกเบี้ยรายวัน
* **Salvage & Scrap:** ระบบขายเครื่องมือ/เครื่องจักรเก่ามือสองเพื่อรับเงินคืนบางส่วน

### 4.2 Dynamic Market System (Supply & Demand)
* **Over-saturation Mechanics:** หากปลูกและขายพืชชนิดเดิมติดต่อกัน ราคาตลาดของพืชชนิดนั้นจะค่อยๆ ลดลง (เช่น ตกเหลือ 50%)
* **Market Recovery:** ราคาจะค่อยๆ ฟื้นฟูกลับมาเมื่อหยุดส่งขายพืชชนิดนั้น เพื่อกระตุ้นให้ผู้เล่นหมุนเวียนพืชที่ปลูก และซื้อ License พืชใหม่ๆ อยู่เสมอ

---

## 5. Technical Requirements & Recommended Stack

* **Game Engine Options:**
  * **Godot Engine (GDScript):** เหมาะสำหรับเกม 2D Lightweight, เปิดฟรี 100%, ทำงานได้รวดเร็ว
  * **Phaser.js / TypeScript:** เหมาะสำหรับเล่นบน Web Browser โดยตรง ไม่ต้องดาวน์โหลด
  * **Unity (C#):** เหมาะสำหรับการพอร์ตลงหลายแพลตฟอร์ม (PC, WebGL, Mobile)
* **Data Persistence:** ระบบ Save/Load ข้อมูลเกมแบบ LocalStorage หรือ JSON File

---

## 6. Technical Master Prompt (สำหรับ AI Code Generator)

```text
Act as a Senior Game Developer. Implement an Incremental/Idle Farm Management Game with the following requirements:

1. Core Architecture:
   - Implement state machines for Crop Growth, Player Energy, Economy, Machinery, and Labor.
   - Use JSON Data Structures for Crops, Licenses, and Machines.

2. Gameplay Systems:
   - 6 initial farm tiles with Manual farming actions (Till, Plant, Water, Harvest).
   - Energy System: Restricts daily manual actions.
   - Decay System: Crops rot on field if unharvested; inventory items spoil if unsold.
   - Automation: Allow hiring workers and placing machines (Sprinklers, Tractors) with daily maintenance/wage costs.
   - Dynamic Market: Reduce crop selling value if oversupplied continuously.

3. Safety Net (Anti-Bankruptcy):
   - Automatically pause machines and workers if Player Cash drops below 0 to avoid soft-locking.
   - Allow emergency manual farming, micro-loans, and selling machinery for salvage cash.

Please generate a modular system architecture and data models to start development.
```