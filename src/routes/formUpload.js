const express = require('express');
const multer = require('multer');
const { supabase } = require('../lib/supabase');

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB — plenty for a scanned/signed form
  fileFilter: (req, file, cb) => {
    const allowed = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'image/jpeg',
      'image/png',
    ];
    cb(null, allowed.includes(file.mimetype));
  },
});

const BUCKET = 'membership-forms';

router.post('/form-upload', upload.single('file'), async (req, res) => {
  try {
    if (!supabase) {
      return res.status(500).json({ error: 'Server is not configured (Supabase env vars missing).' });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'A file is required (PDF, Word doc, or photo of the signed form).' });
    }

    const { type, name, email, phone } = req.body || {};
    if (!type || !['organization', 'client'].includes(type)) {
      return res.status(400).json({ error: 'type must be "organization" or "client"' });
    }
    if (!name || !email) {
      return res.status(400).json({ error: 'name and email are required' });
    }

    const safeName = req.file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    const filePath = `${type}/${Date.now()}-${safeName}`;

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(filePath, req.file.buffer, { contentType: req.file.mimetype });

    if (uploadError) {
      console.error('[form-upload] storage upload failed:', uploadError.message);
      return res.status(500).json({ error: 'Could not upload the file. Please try again.' });
    }

    const { error: dbError } = await supabase.from('form_submissions').insert({
      type,
      name,
      email,
      phone: phone || null,
      file_path: filePath,
    });

    if (dbError) {
      console.error('[form-upload] Supabase insert failed:', dbError.message);
      return res.status(500).json({ error: 'File uploaded, but the record could not be saved.' });
    }

    res.json({ ok: true });
  } catch (err) {
    console.error('[form-upload] unexpected error:', err);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

module.exports = router;
