param(
  [Parameter(Mandatory = $true)]
  [string]$BaseUrl,
  [Parameter(Mandatory = $true)]
  [string]$Email,
  [Parameter(Mandatory = $true)]
  [string]$Password
)

$ErrorActionPreference = "Stop"

function Invoke-PocketBaseAuth {
  param(
    [string]$Url,
    [string]$UserEmail,
    [string]$UserPassword
  )

  $body = @{
    identity = $UserEmail
    password = $UserPassword
  } | ConvertTo-Json

  return Invoke-RestMethod -Uri "$Url/api/collections/_superusers/auth-with-password" -Method POST -ContentType "application/json" -Body $body
}

function New-LivrosCollectionPayload {
  return @{
    name       = "livros"
    type       = "base"
    listRule   = ""
    viewRule   = ""
    createRule = ""
    updateRule = ""
    deleteRule = ""
    fields     = @(
      @{
        name      = "arquivo"
        type      = "file"
        required  = $true
        maxSelect = 10
        maxSize   = 157286400
        mimeTypes = @(
          "application/pdf",
          "application/epub+zip",
          "application/x-mobipocket-ebook",
          "application/vnd.amazon.ebook",
          "application/x-cbr",
          "application/x-cbz",
          "application/zip",
          "text/plain"
        )
      },
      @{
        name      = "capa"
        type      = "file"
        required  = $true
        maxSelect = 1
        maxSize   = 10485760
        mimeTypes = @("image/jpeg", "image/png", "image/webp")
      },
      @{
        name     = "autor"
        type     = "text"
        required = $false
        max      = 255
      },
      @{
        name     = "sinopse"
        type     = "editor"
        required = $true
      },
      @{
        name     = "paginas"
        type     = "number"
        required = $false
        onlyInt  = $true
        min      = 1
      },
      @{
        name     = "genero"
        type     = "text"
        required = $true
        max      = 100
      },
      @{
        name     = "avaliacao"
        type     = "number"
        required = $false
        min      = 0
        max      = 5
      }
    )
  } | ConvertTo-Json -Depth 10
}

function New-ArquivoFieldDefinition {
  return @{
    name      = "arquivo"
    type      = "file"
    required  = $true
    maxSelect = 10
    maxSize   = 157286400
    mimeTypes = @(
      "application/pdf",
      "application/epub+zip",
      "application/x-mobipocket-ebook",
      "application/vnd.amazon.ebook",
      "application/x-cbr",
      "application/x-cbz",
      "application/zip",
      "text/plain"
    )
  }
}

$normalizedBase = $BaseUrl.TrimEnd("/")
$auth = Invoke-PocketBaseAuth -Url $normalizedBase -UserEmail $Email -UserPassword $Password
$headers = @{
  Authorization = "Bearer $($auth.token)"
}

try {
  $existing = Invoke-RestMethod -Uri "$normalizedBase/api/collections/livros" -Method GET -Headers $headers
  $fieldNames = @($existing.fields | ForEach-Object { $_.name })
  if ($fieldNames -contains "arquivo") {
    Write-Output "COLLECTION_EXISTS:$($existing.name)"
  }
  else {
    $updatedFields = @($existing.fields) + @(New-ArquivoFieldDefinition)
    $updatePayload = @{
      fields = $updatedFields
    } | ConvertTo-Json -Depth 12
    $updated = Invoke-RestMethod -Uri "$normalizedBase/api/collections/$($existing.id)" -Method PATCH -Headers $headers -ContentType "application/json" -Body $updatePayload
    Write-Output "COLLECTION_UPDATED:$($updated.name)"
  }
}
catch {
  $payload = New-LivrosCollectionPayload
  $created = Invoke-RestMethod -Uri "$normalizedBase/api/collections" -Method POST -Headers $headers -ContentType "application/json" -Body $payload
  Write-Output "COLLECTION_CREATED:$($created.name)"
}
