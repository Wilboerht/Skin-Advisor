
import { generateSkincareRoutines, getClimateByRegion } from "../src/lib/skincare-dosage";
import { getDefaultFaceAnalysisResult } from "../src/lib/advisor-utils";

console.log("=== Verifying Scientific Skincare Algorithm ===\n");

// Mock Data
const mockSensitive = getDefaultFaceAnalysisResult();
mockSensitive.dimensions.sensitivity.score = 40; // High Sensitivity
if (mockSensitive.labAnalysis) mockSensitive.labAnalysis.erythema.value = 400; // High Erythema
mockSensitive.dimensions.acne.score = 80; // No Acne

const mockAcne = getDefaultFaceAnalysisResult();
mockAcne.dimensions.acne.score = 50; // Severe Acne
if (mockAcne.labAnalysis) mockAcne.labAnalysis.porphyrins.value = 50; // High Porphyrins
mockAcne.dimensions.sensitivity.score = 80; // Not sensitive

const mockAging = getDefaultFaceAnalysisResult();
mockAging.dimensions.wrinkles.score = 50; // Deep Wrinkles
if (mockAging.labAnalysis) mockAging.labAnalysis.glogau.value = "Type III"; // Advanced Aging
mockAging.dimensions.sensitivity.score = 90; // Robust skin

// Test 1: Sensitive Skin
console.log("--- Test Case 1: Sensitive Skin (High Erythema) ---");
const routineSensitive = generateSkincareRoutines("sensitive", "S1", mockSensitive);
const pmStepsSensitive = routineSensitive.professional.evening.steps;
const hasRetinolS = pmStepsSensitive.some((s: any) => s.description.includes("Retinol"));
const hasRepair = pmStepsSensitive.some((s: any) => s.category === "serum_repair");
console.log("Contains Retinol?", hasRetinolS); // Should be NO or very low
console.log("Contains Repair Serum?", hasRepair); // Should be YES
console.log("Step Descriptions:", pmStepsSensitive.map((s: any) => s.description));

// Test 2: Acne Skin
console.log("\n--- Test Case 2: Acne Skin (High Porphyrins) ---");
const routineAcne = generateSkincareRoutines("oily", "S2", mockAcne);
const pmStepsAcne = routineAcne.professional.evening.steps;
const hasBHA = pmStepsAcne.some((s: any) => s.description.includes("Salicylic Acid"));
console.log("Contains Salicylic Acid?", hasBHA); // Should be YES
console.log("Step Descriptions:", pmStepsAcne.map((s: any) => s.description));

// Test 3: Aging Skin
console.log("\n--- Test Case 3: Aging Skin (Type III Glogau) ---");
const routineAging = generateSkincareRoutines("dry", "W1", mockAging);
const pmStepsAging = routineAging.professional.evening.steps;
const hasRetinolA = pmStepsAging.some((s: any) => s.description.includes("Retinol"));
console.log("Contains Retinol?", hasRetinolA); // Should be YES
console.log("Step Descriptions:", pmStepsAging.map((s: any) => s.description));

console.log("\n=== Logic Verification Complete ===");
