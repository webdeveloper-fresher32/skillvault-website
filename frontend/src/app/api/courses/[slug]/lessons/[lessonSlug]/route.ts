import { NextResponse } from 'next/server';
import { getDb } from '@/lib/server/db';
import { readMarkdownFile, parseSubtopics } from '@/lib/server/markdown';
import { getUserIdentifierFromRequest } from '@/lib/server/auth';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string; lessonSlug: string }> }
) {
  try {
    const { slug, lessonSlug } = await params;
    const userIdentifier = getUserIdentifierFromRequest(request);
    const sql = getDb();

    // 1. Fetch Course
    const courseRows = await sql`
      SELECT id, slug, title FROM courses WHERE LOWER(slug) = LOWER(${slug}) LIMIT 1
    `;
    if (!courseRows || courseRows.length === 0) {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 });
    }
    const course = courseRows[0];

    // 2. Fetch all modules and lessons in this course to establish ordering & target lesson
    const modules = await sql`
      SELECT id, title, sort_order FROM course_modules WHERE course_id = ${course.id} ORDER BY sort_order ASC
    `;

    if (modules.length === 0) {
      return NextResponse.json({ error: 'No modules found for course' }, { status: 404 });
    }

    const moduleIds = modules.map((m: any) => m.id);
    const allLessons = await sql`
      SELECT l.id, l.slug, l.title, l.file_path AS "filePath", l.sort_order AS "sortOrder",
             l.estimated_minutes AS "estimatedMinutes", l.module_id AS "moduleId", m.title AS "moduleTitle"
      FROM lessons l
      JOIN course_modules m ON l.module_id = m.id
      WHERE l.module_id = ANY(${moduleIds})
      ORDER BY m.sort_order ASC, l.sort_order ASC
    `;

    const targetIndex = allLessons.findIndex((l: any) => l.slug.toLowerCase() === lessonSlug.toLowerCase());
    if (targetIndex === -1) {
      return NextResponse.json({ error: 'Lesson not found' }, { status: 404 });
    }

    const targetLesson = allLessons[targetIndex];

    // 3. Read markdown content
    let markdown = readMarkdownFile(targetLesson.filePath);
    if (!markdown) {
      markdown = `# ${targetLesson.title}\n\nContent file located at \`${targetLesson.filePath}\` is being prepared.`;
    }

    const subtopics = parseSubtopics(markdown);

    // 4. Progress & Bookmark
    const progressRows = await sql`
      SELECT completed FROM user_progress
      WHERE user_identifier = ${userIdentifier} AND lesson_id = ${targetLesson.id}
      LIMIT 1
    `;
    const completed = progressRows.length > 0 ? Boolean(progressRows[0].completed) : false;

    const bookmarkRows = await sql`
      SELECT id FROM user_bookmarks
      WHERE user_identifier = ${userIdentifier} AND LOWER(course_slug) = LOWER(${slug}) AND LOWER(lesson_slug) = LOWER(${lessonSlug})
      LIMIT 1
    `;
    const bookmarked = bookmarkRows.length > 0;

    const prevLesson = targetIndex > 0 ? allLessons[targetIndex - 1].slug : null;
    const nextLesson = targetIndex < allLessons.length - 1 ? allLessons[targetIndex + 1].slug : null;

    const dto = {
      id: targetLesson.id,
      title: targetLesson.title,
      slug: targetLesson.slug,
      courseSlug: course.slug,
      courseTitle: course.title,
      moduleTitle: targetLesson.moduleTitle,
      sortOrder: targetLesson.sortOrder,
      estimatedMinutes: targetLesson.estimatedMinutes || 20,
      markdownContent: markdown,
      subtopics,
      completed,
      bookmarked,
      prevLessonSlug: prevLesson,
      nextLessonSlug: nextLesson,
    };

    return NextResponse.json(dto);
  } catch (err: any) {
    console.error('Error in GET /api/courses/[slug]/lessons/[lessonSlug]:', err);
    return NextResponse.json({ error: 'Failed to fetch lesson detail', details: err.message }, { status: 500 });
  }
}
