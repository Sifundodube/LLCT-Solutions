const express = require('express');
const multer = require('multer');
const { PDFParse } = require('pdf-parse');
const { supabase } = require('../lib/supabase');
const { requireAdmin } = require('./admin');
const { sendAdminNotification } = require('../lib/email');

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (req, file, cb) => cb(null, file.mimetype === 'application/pdf'),
});
const BUCKET = 'articles';

function isMissingArticlesTable(error) {
  return error && (error.code === '42P01' || /relation .*articles.* does not exist/i.test(error.message || ''));
}

function makeSlug(title) {
  return `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-${Date.now()}`;
}

async function extractPdfText(buffer) {
  const parser = new PDFParse({ data: buffer });
  const parsed = await parser.getText();
  await parser.destroy();
  return (parsed.text || '').replace(/\r/g, '').replace(/[ \t]+\n/g, '\n').trim();
}

router.get('/articles', async (req, res) => {
  res.set('Cache-Control', 'no-store');
  if (!supabase) return res.status(500).json({ error: 'Supabase is not configured.' });
  const { data, error } = await supabase
    .from('articles')
    .select('id, title, slug, summary, content, created_at')
    .eq('published', true)
    .order('created_at', { ascending: false });
  if (error && isMissingArticlesTable(error)) return res.json([]);
  if (error) return res.status(500).json({ error: 'Could not load articles.' });
  res.json(data);
});

router.get('/admin/subscribers', requireAdmin, async (req, res) => {
  if (!supabase) return res.status(500).json({ error: 'Supabase is not configured.' });
  const { data, error } = await supabase
    .from('subscribers')
    .select('id, type, plan_id, name, email, phone, company, payment_method, status, created_at')
    .order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: 'Could not load subscribers.' });
  res.json(data);
});

router.get('/admin/articles', requireAdmin, async (req, res) => {
  if (!supabase) return res.status(500).json({ error: 'Supabase is not configured.' });
  const { data, error } = await supabase.from('articles').select('*').order('created_at', { ascending: false });
  if (error && isMissingArticlesTable(error)) return res.json([]);
  if (error) return res.status(500).json({ error: 'Could not load articles.' });
  res.json(data);
});

router.post('/admin/articles', requireAdmin, upload.single('pdf'), async (req, res) => {
  try {
    if (!supabase) return res.status(500).json({ error: 'Supabase is not configured.' });
    if (!req.file) return res.status(400).json({ error: 'Please upload a PDF file.' });
    const title = (req.body.title || '').trim();
    if (!title) return res.status(400).json({ error: 'Article title is required.' });

    const content = await extractPdfText(req.file.buffer);
    if (!content) return res.status(400).json({ error: 'This PDF has no selectable text to publish.' });

    const slug = makeSlug(title);
    const filePath = `${slug}.pdf`;
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(filePath, req.file.buffer, { contentType: 'application/pdf', upsert: false });
    if (uploadError) return res.status(500).json({ error: 'Could not save the PDF.' });

    const { data: article, error } = await supabase.from('articles').insert({
      title,
      slug,
      summary: content.slice(0, 240),
      content,
      pdf_path: filePath,
      published: true,
    }).select().single();
    if (error) return res.status(500).json({ error: 'PDF saved, but the article record could not be created.' });

    await sendAdminNotification(`New article published: ${title}`, `An article was uploaded and published.\n\nTitle: ${title}\nSlug: ${slug}`);
    res.status(201).json(article);
  } catch (err) {
    console.error('[articles] upload failed:', err);
    res.status(500).json({ error: 'Could not extract this PDF. Please check that it is a valid text PDF.' });
  }
});

router.patch('/admin/articles/:id', requireAdmin, upload.single('pdf'), async (req, res) => {
  try {
    if (!supabase) return res.status(500).json({ error: 'Supabase is not configured.' });
    const { data: existing, error: findError } = await supabase
      .from('articles').select('*').eq('id', req.params.id).single();
    if (findError || !existing) return res.status(404).json({ error: 'Article not found.' });

    const title = (req.body.title || existing.title).trim();
    if (!title) return res.status(400).json({ error: 'Article title is required.' });
    const updates = { title };
    let replacementPath;

    if (req.file) {
      const content = await extractPdfText(req.file.buffer);
      if (!content) return res.status(400).json({ error: 'This PDF has no selectable text to publish.' });
      replacementPath = `${makeSlug(title)}.pdf`;
      const { error: uploadError } = await supabase.storage.from(BUCKET).upload(
        replacementPath, req.file.buffer, { contentType: 'application/pdf', upsert: false }
      );
      if (uploadError) return res.status(500).json({ error: 'Could not save the replacement PDF.' });
      updates.slug = replacementPath.replace(/\.pdf$/, '');
      updates.summary = content.slice(0, 240);
      updates.content = content;
      updates.pdf_path = replacementPath;
    } else if (title !== existing.title) {
      updates.slug = makeSlug(title);
    }

    const { data: article, error } = await supabase
      .from('articles').update(updates).eq('id', req.params.id).select().single();
    if (error) return res.status(500).json({ error: 'Could not update the article.' });
    if (replacementPath && existing.pdf_path) {
      await supabase.storage.from(BUCKET).remove([existing.pdf_path]);
    }
    res.json(article);
  } catch (err) {
    console.error('[articles] update failed:', err);
    res.status(500).json({ error: 'Could not update this article.' });
  }
});

router.delete('/admin/articles/:id', requireAdmin, async (req, res) => {
  try {
    if (!supabase) return res.status(500).json({ error: 'Supabase is not configured.' });
    const { data: existing, error: findError } = await supabase
      .from('articles').select('id, pdf_path').eq('id', req.params.id).single();
    if (findError || !existing) return res.status(404).json({ error: 'Article not found.' });
    const { error } = await supabase.from('articles').delete().eq('id', req.params.id);
    if (error) return res.status(500).json({ error: 'Could not delete the article.' });
    if (existing.pdf_path) await supabase.storage.from(BUCKET).remove([existing.pdf_path]);
    res.json({ ok: true });
  } catch (err) {
    console.error('[articles] delete failed:', err);
    res.status(500).json({ error: 'Could not delete this article.' });
  }
});

module.exports = router;