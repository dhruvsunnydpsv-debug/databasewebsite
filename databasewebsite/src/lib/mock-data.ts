export interface Question {
    id: string;
    question_text: string;
    options: string[] | null;
    correct_answer: string;
    raw_original_text?: string;
    rationale?: string;
    domain?: string;
    difficulty?: string;
    is_placeholder?: boolean;
}

export const MOCK_RW_QUESTIONS: Question[] = [
    {
        id: "mock-rw-1",
        question_text: "Which choice best describes the function of the second sentence in the text as a whole?",
        options: [
            "It provides a specific example to support the claim made in the first sentence.",
            "It introduces a counterargument that the rest of the passage will address.",
            "It summarizes a scientific study mentioned previously in the passage.",
            "It defines a technical term that is central to the author's primary argument."
        ],
        correct_answer: "A",
        raw_original_text: "Recent studies in arboriculture suggest that urban trees grow significantly faster than their rural counterparts. For instance, a survey of silver maples in Chicago found that city trees added biomass at a rate 25% higher than those in neighboring forests.",
        domain: "Information_Ideas",
        difficulty: "Medium"
    },
    {
        id: "mock-rw-2",
        question_text: "Which choice completes the text with the most logical and precise word or phrase?",
        options: [
            "redundant",
            "pivotal",
            "sporadic",
            "peripheral"
        ],
        correct_answer: "B",
        raw_original_text: "The discovery of the Rosetta Stone was ______ to the field of Egyptology, as it provided the key to deciphering ancient Egyptian hieroglyphs, which had previously been unreadable for centuries.",
        domain: "Craft_Structure",
        difficulty: "Easy"
    }
];

export const MOCK_MATH_QUESTIONS: Question[] = [
    {
        id: "mock-math-1",
        question_text: "If 3x + 5 = 20, what is the value of 6x - 10?",
        options: [
            "20",
            "30",
            "40",
            "50"
        ],
        correct_answer: "A",
        raw_original_text: "Solve for x in the linear equation and substitute into the second expression.",
        domain: "Heart_of_Algebra",
        difficulty: "Easy"
    },
    {
        id: "mock-math-2",
        question_text: "A rectangle has a length that is 3 times its width. If the perimeter of the rectangle is 64 centimeters, what is the area of the rectangle in square centimeters?",
        options: [
            "144",
            "192",
            "256",
            "576"
        ],
        correct_answer: "B",
        raw_original_text: "Geometry problem involving perimeter and area of a rectangle with given proportions.",
        domain: "Geometry_Trigonometry",
        difficulty: "Hard"
    }
];

export function getMockQuestions(subject: "rw" | "math", count: number): Question[] {
    const pool = subject === "rw" ? MOCK_RW_QUESTIONS : MOCK_MATH_QUESTIONS;
    const results: Question[] = [];
    for (let i = 0; i < count; i++) {
        const template = pool[i % pool.length];
        results.push({
            ...template,
            id: `emergency-mock-${subject}-${i}`
        });
    }
    return results;
}
