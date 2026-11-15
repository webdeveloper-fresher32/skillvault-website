-- 1. Insert or update the course 'my-work'
INSERT INTO courses (slug, title, description, category, level, icon, total_lessons, estimated_hours)
VALUES (
    'my-work',
    'My Work: Production Engineering Blueprints',
    'Exhaustive production architectures, distributed locking, multi-tenant RAG, LangGraph agent workflows, and senior technical interview battle cards.',
    'My Work',
    'Advanced',
    'sparkles',
    8,
    8
)
ON CONFLICT (slug) DO UPDATE SET
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    category = EXCLUDED.category,
    level = EXCLUDED.level,
    icon = EXCLUDED.icon,
    total_lessons = EXCLUDED.total_lessons,
    estimated_hours = EXCLUDED.estimated_hours;

DO $$
DECLARE
    v_course_id BIGINT;
    v_mod1_id BIGINT;
    v_mod2_id BIGINT;
    v_mod3_id BIGINT;
BEGIN
    SELECT id INTO v_course_id FROM courses WHERE slug = 'my-work';

    -- 2. Module 1: Stripe Billing System
    SELECT id INTO v_mod1_id FROM course_modules WHERE course_id = v_course_id AND slug = 'phase-01-stripe-billing-system';
    IF v_mod1_id IS NULL THEN
        INSERT INTO course_modules (slug, title, sort_order, course_id)
        VALUES ('phase-01-stripe-billing-system', 'Stripe Billing System', 1, v_course_id)
        RETURNING id INTO v_mod1_id;
    ELSE
        UPDATE course_modules SET title = 'Stripe Billing System', sort_order = 1 WHERE id = v_mod1_id;
    END IF;

    -- 3. Module 2: AI Chat Assistant and RAG
    SELECT id INTO v_mod2_id FROM course_modules WHERE course_id = v_course_id AND slug = 'phase-02-ai-chat-assistant-and-rag';
    IF v_mod2_id IS NULL THEN
        INSERT INTO course_modules (slug, title, sort_order, course_id)
        VALUES ('phase-02-ai-chat-assistant-and-rag', 'AI Chat Assistant and RAG', 2, v_course_id)
        RETURNING id INTO v_mod2_id;
    ELSE
        UPDATE course_modules SET title = 'AI Chat Assistant and RAG', sort_order = 2 WHERE id = v_mod2_id;
    END IF;

    -- 4. Module 3: Interview Battle Cards
    SELECT id INTO v_mod3_id FROM course_modules WHERE course_id = v_course_id AND slug = 'phase-03-interview-battle-cards';
    IF v_mod3_id IS NULL THEN
        INSERT INTO course_modules (slug, title, sort_order, course_id)
        VALUES ('phase-03-interview-battle-cards', 'Interview Battle Cards', 3, v_course_id)
        RETURNING id INTO v_mod3_id;
    ELSE
        UPDATE course_modules SET title = 'Interview Battle Cards', sort_order = 3 WHERE id = v_mod3_id;
    END IF;

    -- Clean old lessons for these modules to avoid duplicates
    DELETE FROM lessons WHERE module_id IN (v_mod1_id, v_mod2_id, v_mod3_id);

    -- Module 1 Lessons
    INSERT INTO lessons (slug, title, file_path, sort_order, estimated_minutes, module_id)
    VALUES 
    ('01-production-billing-architecture', 'Production Billing Architecture and Webhook Event Machine', '/content/My-Work/Phase-01-Stripe-Billing-System/01-Production-Billing-Architecture.md', 1, 25, v_mod1_id),
    ('02-duplicate-payment-prevention-and-acid', 'Duplicate Payment Prevention, Idempotency and ACID Locking', '/content/My-Work/Phase-01-Stripe-Billing-System/02-Duplicate-Payment-Prevention-and-ACID.md', 2, 25, v_mod1_id),
    ('03-subscription-lifecycle-and-proration', 'Subscription State Machine, Upgrades, Downgrades and Proration', '/content/My-Work/Phase-01-Stripe-Billing-System/03-Subscription-Lifecycle-and-Proration.md', 3, 25, v_mod1_id);

    -- Module 2 Lessons
    INSERT INTO lessons (slug, title, file_path, sort_order, estimated_minutes, module_id)
    VALUES 
    ('01-multi-tenant-rag-and-langgraph-architecture', 'Multi-Tenant RAG and LangGraph Agentic Architecture', '/content/My-Work/Phase-02-AI-Chat-Assistant-and-RAG/01-Multi-Tenant-RAG-and-LangGraph-Architecture.md', 1, 25, v_mod2_id),
    ('02-hybrid-search-rrf-and-cross-encoder', 'Two-Stage Hybrid Retrieval, RRF and Cross-Encoder Reranking', '/content/My-Work/Phase-02-AI-Chat-Assistant-and-RAG/02-Hybrid-Search-RRF-and-Cross-Encoder.md', 2, 25, v_mod2_id),
    ('03-realtime-sse-streaming-and-hitl', 'Real-Time Token Streaming (SSE) and Durable HITL Checkpoints', '/content/My-Work/Phase-02-AI-Chat-Assistant-and-RAG/03-Realtime-SSE-Streaming-and-HITL.md', 3, 25, v_mod2_id);

    -- Module 3 Lessons
    INSERT INTO lessons (slug, title, file_path, sort_order, estimated_minutes, module_id)
    VALUES 
    ('01-stripe-billing-senior-battle-cards', 'Stripe Billing and Payments: Senior Interview Battle Cards', '/content/My-Work/Phase-03-Interview-Battle-Cards/01-Stripe-Billing-Senior-Battle-Cards.md', 1, 20, v_mod3_id),
    ('02-ai-rag-langgraph-senior-battle-cards', 'Multi-Tenant RAG and LangGraph: Senior Interview Battle Cards', '/content/My-Work/Phase-03-Interview-Battle-Cards/02-AI-RAG-LangGraph-Senior-Battle-Cards.md', 2, 20, v_mod3_id);

END $$;
