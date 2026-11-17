// Read the text in a PNG band via the headless page? No OCR available. Instead compare the
// rendered DOM text of HEAD vs the committed screenshot's provenance: check git history of the shots.
import fs from 'node:fs';
const {execFileSync}=require('node:child_process');
