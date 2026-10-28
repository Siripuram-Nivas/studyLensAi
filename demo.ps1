# StudyLens AI API demo (PowerShell 5.1+).
# Start the backend first:
#   cd backend
#   uvicorn app.main:app --reload --port 8000
# Then run:
#   powershell -ExecutionPolicy Bypass -File .\demo.ps1
#
# The script creates one temporary material, exercises the real endpoints,
# prints whether AI is configured, and deletes only the material it created.

param(
    [string]$BaseUrl = "http://127.0.0.1:8000"
)

$ErrorActionPreference = "Stop"

function Show-Json($value) {
    $value | ConvertTo-Json -Depth 8
}

Write-Host "`n== Health ==" -ForegroundColor Cyan
$health = Invoke-RestMethod -Uri "$BaseUrl/api/health"
Show-Json $health

Write-Host "`n== AI status ==" -ForegroundColor Cyan
$ai = Invoke-RestMethod -Uri "$BaseUrl/api/ai/status"
Show-Json $ai

Write-Host "`n== Create pasted-text material ==" -ForegroundColor Cyan
$sampleText = @"
Normalization organizes columns and tables in a relational database to reduce
redundancy and improve data integrity. First normal form requires atomic values.
Second normal form removes partial dependencies. Third normal form removes
transitive dependencies. Denormalization can improve read performance at the
cost of duplicated data and more careful updates.
"@
$body = @{
    title = "Demo - database normalization"
    text  = $sampleText.Trim()
} | ConvertTo-Json
$material = Invoke-RestMethod -Uri "$BaseUrl/api/materials/text" -Method Post `
    -ContentType "application/json" -Body $body
Show-Json @{
    id         = $material.id
    title      = $material.title
    word_count = $material.word_count
    characters = $material.extracted_text.Length
    pages      = $material.pages.Count
}

try {
    Write-Host "`n== Generate summary (requires a configured AI provider) ==" -ForegroundColor Cyan
    try {
        $summary = Invoke-RestMethod -Uri "$BaseUrl/api/materials/$($material.id)/summary" `
            -Method Post -ContentType "application/json" `
            -Body (@{ difficulty = "beginner" } | ConvertTo-Json)
        Show-Json $summary.result
    }
    catch {
        Write-Host "Summary request failed as reported by the backend:" -ForegroundColor Yellow
        if ($_.ErrorDetails.Message) { Write-Host $_.ErrorDetails.Message }
        else { Write-Host $_.Exception.Message }
    }

    Write-Host "`n== Generate a practice quiz (requires a configured AI provider) ==" -ForegroundColor Cyan
    try {
        $quiz = Invoke-RestMethod -Uri "$BaseUrl/api/quizzes/generate" `
            -Method Post -ContentType "application/json" `
            -Body (@{
                material_id  = $material.id
                num_questions = 5
                difficulty    = "intermediate"
            } | ConvertTo-Json)
        Show-Json @{
            quiz_id       = $quiz.id
            title         = $quiz.title
            num_questions = $quiz.num_questions
            note          = "Answers are intentionally absent until submission."
        }
    }
    catch {
        Write-Host "Quiz request failed as reported by the backend:" -ForegroundColor Yellow
        if ($_.ErrorDetails.Message) { Write-Host $_.ErrorDetails.Message }
        else { Write-Host $_.Exception.Message }
    }

    Write-Host "`n== Analytics ==" -ForegroundColor Cyan
    Show-Json (Invoke-RestMethod -Uri "$BaseUrl/api/analytics/overview")
}
finally {
    Write-Host "`n== Clean up the demo material ==" -ForegroundColor Cyan
    Invoke-RestMethod -Uri "$BaseUrl/api/materials/$($material.id)" -Method Delete
    Write-Host "Deleted material $($material.id)."
}

Write-Host "`nDemo complete. Open http://localhost:5173 to use the UI." -ForegroundColor Green
