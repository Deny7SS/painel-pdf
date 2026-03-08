
$username = "denysouzah7@gmail.com"
$password = "santos12345FC@"
$baseUrl = "https://kings01.store"

# 1. Authenticate
$authBody = @{
    identity = $username
    password = $password
}
try {
    $authResponse = Invoke-RestMethod -Uri "$baseUrl/api/collections/_superusers/auth-with-password" -Method Post -Body $authBody
    $token = $authResponse.token
    Write-Host "Autenticado com sucesso."
} catch {
    Write-Error "Falha na autenticação: $_"
    exit
}

$headers = @{
    "Authorization" = "Bearer $token"
    "Content-Type"  = "application/json"
}

# 2. Get current collection schema
try {
    $collection = Invoke-RestMethod -Uri "$baseUrl/api/collections/livros" -Method Get -Headers $headers
    Write-Host "Coleção 'livros' obtida."
} catch {
    Write-Error "Falha ao buscar coleção: $_"
    exit
}

# 3. Check/Add 'titulo' field
$schema = $collection.schema
$hasTitle = $false
foreach ($field in $schema) {
    if ($field.name -eq "titulo") {
        $hasTitle = $true
        break
    }
}

if ($hasTitle) {
    Write-Host "O campo 'titulo' já existe."
} else {
    Write-Host "Adicionando campo 'titulo'..."
    
    $newField = @{
        system = $false
        id = ""
        name = "titulo"
        type = "text"
        required = $true
        presentable = $true
        unique = $false
        options = @{
            min = $null
            max = $null
            pattern = ""
        }
    }
    
    $schema += $newField
    
    # 4. Update collection
    $body = @{
        schema = $schema
    }
    
    try {
        $jsonBody = $body | ConvertTo-Json -Depth 10
        $updateResponse = Invoke-RestMethod -Uri "$baseUrl/api/collections/livros" -Method Patch -Headers $headers -Body $jsonBody
        Write-Host "Coleção atualizada com sucesso! Campo 'titulo' adicionado."
    } catch {
        Write-Error "Falha ao atualizar coleção: $_"
        exit
    }
}
