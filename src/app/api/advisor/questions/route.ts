import { NextResponse } from "next/server";
import { DEFAULT_QUESTIONS } from "@/config/questions";

export async function GET() {
    return NextResponse.json(DEFAULT_QUESTIONS);
}

