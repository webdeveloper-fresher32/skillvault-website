import { NextResponse } from 'next/server';
import { getDb } from '@/lib/server/db';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const sql = getDb();

    const courseRows = await sql`
      SELECT id, slug, title, description, category, level, icon, 
             total_lessons AS "totalLessons", estimated_hours AS "estimatedHours"
      FROM courses
      WHERE LOWER(slug) = LOWER(${slug})
      LIMIT 1
    `;

    if (!courseRows || courseRows.length === 0) {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 });
    }

    const course = courseRows[0];

    // Fetch modules
    const modules = await sql`
      SELECT id, slug, title, sort_order AS "sortOrder"
      FROM course_modules
      WHERE course_id = ${course.id}
      ORDER BY sort_order ASC
    `;

    // Fetch lessons for all modules
    if (modules.length > 0) {
      const moduleIds = modules.map((m: any) => m.id);
      const lessons = await sql`
        SELECT id, slug, title, file_path AS "filePath", sort_order AS "sortOrder", 
               estimated_minutes AS "estimatedMinutes", module_id AS "moduleId"
        FROM lessons
        WHERE module_id = ANY(${moduleIds})
        ORDER BY sort_order ASC
      `;

      const lessonsByModule = new Map<number, any[]>();
      for (const lesson of lessons) {
        if (!lessonsByModule.has(lesson.moduleId)) {
          lessonsByModule.set(lesson.moduleId, []);
        }
        lessonsByModule.get(lesson.moduleId)!.push(lesson);
      }

      for (const mod of modules) {
        mod.lessons = lessonsByModule.get(mod.id) || [];
      }
    }

    course.modules = modules;

    return NextResponse.json(course);
  } catch (err: any) {
    console.error('Error in GET /api/courses/[slug]:', err);
    return NextResponse.json({ error: 'Failed to fetch course', details: err.message }, { status: 500 });
  }
}
