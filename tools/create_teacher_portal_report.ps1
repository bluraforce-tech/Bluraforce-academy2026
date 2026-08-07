$ErrorActionPreference = 'Stop'

$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$outputDir = Join-Path $root 'deliverables'
New-Item -ItemType Directory -Force -Path $outputDir | Out-Null
$docxPath = Join-Path $outputDir 'Teacher_Portal_Getting_Started_Guide.docx'
$pdfPath = Join-Path $outputDir 'Teacher_Portal_Getting_Started_Guide.pdf'
$logoPath = Join-Path $root 'public\high-achievers-logo.png'
if (Test-Path $docxPath) { Remove-Item -LiteralPath $docxPath -Force }
if (Test-Path $pdfPath) { Remove-Item -LiteralPath $pdfPath -Force }

$word = New-Object -ComObject Word.Application
$word.Visible = $false
$word.DisplayAlerts = 0
$doc = $word.Documents.Add()

function Set-Font($range, $name='Aptos', $size=10.5, $bold=0, $color=0) {
  $range.Font.Name = $name
  $range.Font.Size = $size
  $range.Font.Bold = $bold
  $range.Font.Color = $color
}

function Add-Paragraph([string]$text, [string]$style='Normal', [double]$after=6, [double]$before=0) {
  $sel = $word.Selection
  $sel.EndKey(6) | Out-Null
  $sel.Style = $style
  $sel.ParagraphFormat.SpaceBefore = $before
  $sel.ParagraphFormat.SpaceAfter = $after
  $sel.ParagraphFormat.LineSpacingRule = 0
  $start = $sel.Start
  $sel.TypeText($text)
  $sel.TypeParagraph()
  $p = $doc.Range($start, $sel.Start).Paragraphs.Item(1)
  $p.Format.SpaceBefore = $before
  $p.Format.SpaceAfter = $after
  $p.Format.LineSpacingRule = 0
  return $p
}

function Add-Bullet([string]$text, [int]$level=1) {
  $p = Add-Paragraph $text 'Normal' 3 0
  $p.Range.ListFormat.ApplyBulletDefault()
  if ($level -gt 1) { $p.Range.ListFormat.ListIndent() }
  return $p
}

function Add-Step([int]$number, [string]$title, [string]$body) {
  $p = Add-Paragraph "$number. $title" 'Normal' 2 2
  $p.Range.Font.Bold = 1
  $p.Range.Font.Color = 9258017
  $p.Range.Font.Size = 11.5
  $bodyP = Add-Paragraph $body 'Normal' 7 0
  $bodyP.Format.LeftIndent = 18
  return $bodyP
}

function Add-Callout([string]$label, [string]$text, [int]$fill=15790320) {
  $sel = $word.Selection; $sel.EndKey(6) | Out-Null
  $table = $doc.Tables.Add($sel.Range, 1, 1)
  $table.AllowAutoFit = $false
  $table.Columns.Item(1).Width = 468
  $table.Cell(1,1).Shading.BackgroundPatternColor = $fill
  $table.Cell(1,1).VerticalAlignment = 1
  $table.Cell(1,1).Range.Text = "$label`r$text"
  $table.Cell(1,1).Range.ParagraphFormat.SpaceAfter = 3
  $table.Cell(1,1).Range.ParagraphFormat.SpaceBefore = 3
  $table.Cell(1,1).Range.Font.Name = 'Aptos'
  $table.Cell(1,1).Range.Font.Size = 10.5
  $table.Cell(1,1).Range.Paragraphs.Item(1).Range.Font.Bold = 1
  $table.Cell(1,1).Range.Paragraphs.Item(1).Range.Font.Color = 9258017
  $table.Borders.Enable = 0
  Add-Paragraph '' 'Normal' 2 0 | Out-Null
}

function Add-PageBreak {
  $sel = $word.Selection; $sel.EndKey(6) | Out-Null; $sel.InsertBreak(7)
}

# Page geometry and style tokens: compact_reference_guide preset.
$section = $doc.Sections.Item(1)
$section.PageSetup.PaperSize = 0
$section.PageSetup.TopMargin = 54
$section.PageSetup.BottomMargin = 54
$section.PageSetup.LeftMargin = 58
$section.PageSetup.RightMargin = 58

$normal = $doc.Styles.Item('Normal')
$normal.Font.Name = 'Aptos'
$normal.Font.Size = 10.5
$normal.Font.Color = 3355443
$normal.ParagraphFormat.SpaceAfter = 6

foreach ($pair in @(
  @('Title', 28, 9258017, 1, 8, 0),
  @('Subtitle', 13, 7237230, 0, 12, 0),
  @('Heading 1', 18, 9258017, 1, 8, 12),
  @('Heading 2', 12.5, 12287232, 1, 5, 8),
  @('Heading 3', 11, 9258017, 1, 3, 6)
)) {
  $s = $doc.Styles.Item([string]$pair[0]); $s.Font.Name='Aptos'; $s.Font.Size=[single]$pair[1]; $s.Font.Color=[int]$pair[2]; $s.Font.Bold=[int]$pair[3];
  $s.ParagraphFormat.SpaceAfter=[single]$pair[4]; $s.ParagraphFormat.SpaceBefore=[single]$pair[5]; $s.ParagraphFormat.KeepWithNext=-1
}

# Header and footer.
$header = $section.Headers.Item(1)
$header.Range.Text = 'HIGH ACHIEVERS  |  TEACHER PORTAL'
$header.Range.Font.Name = 'Aptos'
$header.Range.Font.Size = 8.5
$header.Range.Font.Bold = 1
$header.Range.Font.Color = 8421504
$footer = $section.Footers.Item(1)
$footer.Range.Text = 'Teacher Getting Started Guide  •  Internal Use'
$footer.Range.Font.Name = 'Aptos'
$footer.Range.Font.Size = 8
$footer.Range.Font.Color = 8421504
$footer.Range.ParagraphFormat.Alignment = 2

# Cover.
$spacer = Add-Paragraph '' 'Normal' 0 30
if (Test-Path $logoPath) {
  $logoParagraph = Add-Paragraph '' 'Normal' 0 0
  $shape = $doc.InlineShapes.AddPicture($logoPath, $false, $true, $logoParagraph.Range)
  $shape.LockAspectRatio = -1; $shape.Width = 260
  $shape.Range.ParagraphFormat.Alignment = 1
}
$p = Add-Paragraph 'TEACHER PORTAL' 'Normal' 3 30
Set-Font $p.Range 'Aptos' 11 1 12287232
$p.Range.ParagraphFormat.Alignment = 1
$p = Add-Paragraph 'Getting Started Guide' 'Title' 8 0
$p.Range.ParagraphFormat.Alignment = 1
$p = Add-Paragraph 'A practical first-day guide for setting up your teaching space, enrolling students, publishing learning content, and reviewing progress.' 'Subtitle' 24 0
$p.Range.ParagraphFormat.Alignment = 1
Add-Callout 'Start here' 'Use the portal in this order: choose your teaching environment, create student codes, confirm enrolment, then publish content or assessments.' 15794160
$p = Add-Paragraph 'Prepared for teachers using the Academy platform' 'Normal' 4 30
$p.Range.ParagraphFormat.Alignment = 1; $p.Range.Font.Bold = 1
$p = Add-Paragraph 'Version: August 2026' 'Normal' 0 0
$p.Range.ParagraphFormat.Alignment = 1; $p.Range.Font.Color = 8421504

Add-PageBreak
Add-Paragraph '1. Before You Begin' 'Heading 1' | Out-Null
Add-Paragraph 'Your teacher account is created by the platform administrator. There is no public teacher registration page. Keep the login details provided by the administrator private.' | Out-Null
Add-Paragraph 'First-login checklist' 'Heading 2' | Out-Null
Add-Bullet 'Open the teacher login page and sign in with the credentials supplied by the administrator.' | Out-Null
Add-Bullet 'Confirm that the dashboard displays your name and the label “teacher workspace.”' | Out-Null
Add-Bullet 'Set the correct teaching environment before creating codes, questions, exams, videos, books, or study notes.' | Out-Null
Add-Bullet 'Confirm that the dashboard shows the expected navigation options for the selected environment.' | Out-Null
Add-Callout 'Important' 'The selected environment controls which students and content are available. When you switch environments, new codes and new content use the new selection.' 15987699

Add-Paragraph 'Choose the teaching environment' 'Heading 2' | Out-Null
Add-Step 1 'Open Dashboard' 'Find the “Teaching environment” panel near the top of the page.' | Out-Null
Add-Step 2 'Select the education system' 'Choose American or National. Then choose the matching American category or National grade.' | Out-Null
Add-Step 3 'Save the selection' 'Select “Set environment.” Later, use “Switch environment” when you need to work with another group.' | Out-Null

Add-Paragraph 'What changes by environment?' 'Heading 2' | Out-Null
$sel = $word.Selection; $sel.EndKey(6) | Out-Null; $t = $doc.Tables.Add($sel.Range, 3, 3)
$t.AllowAutoFit = $false
$widths = @(112,170,186)
for($i=1;$i -le 3;$i++){ $t.Columns.Item($i).Width=$widths[$i-1] }
$data = @(
  @('Environment','Main activity area','Organization'),
  @('American','Assignments','Create assignments directly; no Unit grouping.'),
  @('National','Question Bank','Create Units, then Self Practice or Homework modules.')
)
for($r=1;$r -le 3;$r++){for($c=1;$c -le 3;$c++){$t.Cell($r,$c).Range.Text=$data[$r-1][$c-1];$t.Cell($r,$c).Range.Font.Name='Aptos';$t.Cell($r,$c).Range.Font.Size=9.5;$t.Cell($r,$c).VerticalAlignment=1}}
$t.Rows.Item(1).Range.Font.Bold=1; $t.Rows.Item(1).Range.Font.Color=16777215; $t.Rows.Item(1).Shading.BackgroundPatternColor=9258017
$t.Borders.Enable=1
Add-Paragraph '' 'Normal' 2 0 | Out-Null

Add-PageBreak
Add-Paragraph '2. Enrol Students with Invitation Codes' 'Heading 1' | Out-Null
Add-Paragraph 'Students become connected to your teaching space by redeeming a secure, one-time invitation code. Generate codes only after choosing the correct environment.' | Out-Null
Add-Step 1 'Open Invitation codes' 'From the teacher menu, open “Invitation codes,” then select “Generate student codes.”' | Out-Null
Add-Step 2 'Confirm the target group' 'Check the education system and grade/category. This determines which students can use the code.' | Out-Null
Add-Step 3 'Choose the quantity' 'Generate from 1 to 20 codes in one batch.' | Out-Null
Add-Step 4 'Distribute securely' 'Copy the codes, download the generated PDF, or print one card for each student.' | Out-Null
Add-Step 5 'Confirm enrolment' 'After students redeem their codes, check the dashboard’s “Enrolled students” count and student selectors in content forms.' | Out-Null
Add-Callout 'Code rules' 'Each invitation code can be redeemed once. Codes expire after 2 days. Student access to the teacher lasts 30 days after redemption.' 15794160
Add-Paragraph 'Good practice' 'Heading 2' | Out-Null
Add-Bullet 'Give each code to only one intended student.' | Out-Null
Add-Bullet 'Do not post code sheets publicly or reuse a redeemed code.' | Out-Null
Add-Bullet 'Regenerate a new code if an unused code expires.' | Out-Null
Add-Bullet 'Revoke an active code from the invitation-code list when it should no longer be used.' | Out-Null

Add-Paragraph 'Dashboard checks' 'Heading 2' | Out-Null
Add-Paragraph 'Use the four dashboard cards as a quick health check: Enrolled students, Active codes, Exam completion, and Average score. Values are live and reflect the currently available records.' | Out-Null

Add-PageBreak
Add-Paragraph '3. Create and Assign Learning Content' 'Heading 1' | Out-Null
Add-Paragraph 'The portal supports lesson videos, material books, study notes, assignments, self-practice activities, homework, and standard exams.' | Out-Null

Add-Paragraph 'Lesson videos' 'Heading 2' | Out-Null
Add-Bullet 'Enter a title and YouTube URL; optionally add description, lesson name, and category.' | Out-Null
Add-Bullet 'Set availability dates and a maximum number of views when required.' | Out-Null
Add-Bullet 'Choose Publish now, then assign to all matching students or selected students.' | Out-Null
Add-Callout 'Video privacy note' 'The portal controls access and playback sessions, but embedded YouTube content cannot be made fully private. Avoid uploading confidential material.' 15987699

Add-Paragraph 'Material Books and Study Notes' 'Heading 2' | Out-Null
Add-Bullet 'Add the title, material type, description, resource URL, and optional cover-image URL.' | Out-Null
Add-Bullet 'Use availability dates to control when students can access the resource.' | Out-Null
Add-Bullet 'Keep “Published” selected when the item is ready, and choose all matching students or individual students.' | Out-Null
Add-Bullet 'For protected files, use the organization’s approved private-storage process. A shared public link can be forwarded outside the portal.' | Out-Null

Add-Paragraph 'National workflow: Units and activities' 'Heading 2' | Out-Null
Add-Step 1 'Create a Unit' 'Open Question Bank, enter a Unit title and optional description, and save it.' | Out-Null
Add-Step 2 'Choose an activity type' 'Open the Unit and select Self Practice (untimed, no deadline) or Homework (untimed, with a deadline).' | Out-Null
Add-Step 3 'Add questions' 'Reuse saved questions and/or upload a question-page image. Add each question, points, choices, and at least one correct answer.' | Out-Null
Add-Step 4 'Assign and monitor' 'Assign all matching students, then use “Students & scores” to monitor submissions.' | Out-Null

Add-Paragraph 'American workflow: Assignments' 'Heading 2' | Out-Null
Add-Paragraph 'Open Assignments, enter the assignment title, choose saved questions or upload new question pages, mark correct answers, and assign the activity. American assignments are created directly without Units.' | Out-Null

Add-PageBreak
Add-Paragraph '4. Build Exams and Review Results' 'Heading 1' | Out-Null
Add-Paragraph 'Use the Exams section for timed, versioned assessments. The teacher can create a new exam, generate a random exam from earlier questions, or reuse complete pages from old exams.' | Out-Null

Add-Paragraph 'Create a standard exam' 'Heading 2' | Out-Null
Add-Step 1 'Set exam details' 'Enter title, duration, description, instructions, start/end dates, maximum attempts, and optional passing score.' | Out-Null
Add-Step 2 'Choose the audience' 'Assign to all active students or clear that option and select individual students.' | Out-Null
Add-Step 3 'Add question pages' 'Upload a page image, then add all questions beneath it. Set question numbers, points, answer choices, and correct answers.' | Out-Null
Add-Step 4 'Preview and finish' 'Review the exam, then choose Save draft or Publish & assign.' | Out-Null

Add-Paragraph 'Other exam options' 'Heading 2' | Out-Null
Add-Bullet 'Random exam: choose the number of questions, timing, attempts, and students. The system draws from earlier standard exams in the active environment.' | Out-Null
Add-Bullet 'Exam from old questions: select complete uploaded pages from previous exams and reuse all questions on those pages.' | Out-Null
Add-Bullet 'Visibility: show or hide an exam from students from the Exams list.' | Out-Null
Add-Bullet 'Editing: edit versioned exams from the exam list; confirm the active environment matches the exam.' | Out-Null

Add-Paragraph 'Review performance' 'Heading 2' | Out-Null
Add-Bullet 'Open an exam or activity and select “Students & scores” or the Results action.' | Out-Null
Add-Bullet 'Review student name, attempt number, status, score, total points, and submission time.' | Out-Null
Add-Bullet 'Select “Review answers” for the question-by-question result of a specific attempt.' | Out-Null
Add-Bullet 'Use Dashboard Exam completion and Average score for a quick overall summary.' | Out-Null

Add-Callout 'Publishing check' 'Before publishing, verify the environment, audience, availability dates, answer key, points, duration, and attempt limit. A draft is safer when the content is not fully reviewed.' 15794160

Add-PageBreak
Add-Paragraph '5. First-Day Operating Checklist' 'Heading 1' | Out-Null
$checkItems = @(
  'Sign in successfully with the teacher account.',
  'Select and save the correct teaching environment.',
  'Generate a small test batch of invitation codes.',
  'Ask one test student to redeem a code and confirm enrolment.',
  'Create one draft item (video, book, note, assignment, or activity).',
  'Verify the intended students appear in the assignment list.',
  'Create a short test exam and check all correct answers and points.',
  'Publish only after previewing the content and schedule.',
  'Submit the test as a student, then confirm the result appears.',
  'Sign out when work is complete, especially on a shared device.'
)
foreach($item in $checkItems){
  $p=Add-Paragraph "☐  $item" 'Normal' 5 0
  $p.Range.Font.Size=11
}

Add-Paragraph 'Common problems and quick fixes' 'Heading 2' | Out-Null
$sel = $word.Selection; $sel.EndKey(6) | Out-Null; $t2 = $doc.Tables.Add($sel.Range, 5, 2)
$t2.AllowAutoFit=$false; $t2.Columns.Item(1).Width=170; $t2.Columns.Item(2).Width=298
$problems=@(
  @('Content section is missing','Return to Dashboard and confirm the selected environment. American uses Assignments; National uses Question Bank.'),
  @('No students appear','Confirm students redeemed valid codes for this teacher and still have active access.'),
  @('Exam cannot be saved','Check required fields, dates, question text, at least two choices, correct answers, and selected students.'),
  @('No old questions available','Create and save a regular exam or Unit activity first, in the same environment.'),
  @('Student cannot open content','Check publication status, assignment, availability dates, enrolment, and any view or attempt limit.')
)
for($r=1;$r -le 5;$r++){for($c=1;$c -le 2;$c++){$t2.Cell($r,$c).Range.Text=$problems[$r-1][$c-1];$t2.Cell($r,$c).Range.Font.Name='Aptos';$t2.Cell($r,$c).Range.Font.Size=9.5;$t2.Cell($r,$c).VerticalAlignment=1};$t2.Cell($r,1).Range.Font.Bold=1;$t2.Cell($r,1).Shading.BackgroundPatternColor=15794160}
$t2.Borders.Enable=1
Add-Paragraph '' 'Normal' 2 0 | Out-Null

Add-Paragraph 'Need help?' 'Heading 2' | Out-Null
Add-Paragraph 'Contact the platform administrator when login credentials fail, the teacher profile is incomplete, the wrong role is shown, or a required database feature is unavailable. Include the page name and the exact on-screen error message, but never send passwords or invitation codes.' | Out-Null

# Add page numbers to the footer.
$footer.Range.InsertAfter('   |   Teacher reference')

# Final layout controls.
$doc.Content.ParagraphFormat.WidowControl = -1

Write-Output 'Saving DOCX...'
$doc.SaveAs2([string]$docxPath, 16)
Write-Output 'Exporting PDF...'
$doc.ExportAsFixedFormat([string]$pdfPath, 17)
$doc.Close($false)
$word.Quit()
[System.Runtime.InteropServices.Marshal]::ReleaseComObject($doc) | Out-Null
[System.Runtime.InteropServices.Marshal]::ReleaseComObject($word) | Out-Null
Write-Output $docxPath
Write-Output $pdfPath
