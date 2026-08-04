[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidateSet('status', 'configure-ai', 'configure-cos', 'test-ai', 'start-runtime')]
    [string]$Action,

    [Parameter(Mandatory = $true)]
    [ValidatePattern('^[A-Za-z0-9_-]{2,8192}$')]
    [string]$InputBase64Url
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
Add-Type -AssemblyName System.Security
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$SchemaVersion = 'shiguang.integration-config-result.v1'
$SecretsRoot = Join-Path $env:USERPROFILE '.workbuddy\secrets'
$AiConfigPath = Join-Path $SecretsRoot 'shiguang-ai-provider-v1.dpapi.json'
$CosConfigPath = Join-Path $env:USERPROFILE '.workbuddy\cos.env'
$TaskPath = '\PAW\'
$TaskName = 'HomeNodeGateway-Shiguang'

function Write-Result([hashtable]$Value, [int]$ExitCode = 0) {
    $Value.schema_version = $SchemaVersion
    [Console]::Out.Write(($Value | ConvertTo-Json -Compress -Depth 8))
    exit $ExitCode
}

function Fail([string]$Code) {
    Write-Result @{ ok = $false; code = $Code } 2
}

function Request-SecretCredential(
    [string]$Title,
    [string]$Message,
    [bool]$UserNameRequired,
    [string]$DefaultUserName
) {
    $form = New-Object Windows.Forms.Form
    $form.Text = $Title
    $form.ClientSize = New-Object Drawing.Size(480, 230)
    $form.FormBorderStyle = [Windows.Forms.FormBorderStyle]::FixedDialog
    $form.MaximizeBox = $false
    $form.MinimizeBox = $false
    $form.ShowInTaskbar = $true
    $form.StartPosition = [Windows.Forms.FormStartPosition]::CenterScreen
    $form.TopMost = $true

    $messageLabel = New-Object Windows.Forms.Label
    $messageLabel.Text = $Message
    $messageLabel.Location = New-Object Drawing.Point(20, 18)
    $messageLabel.Size = New-Object Drawing.Size(440, 42)

    $userLabel = New-Object Windows.Forms.Label
    $userLabel.Text = if ($UserNameRequired) { 'SecretId' } else { 'Account' }
    $userLabel.Location = New-Object Drawing.Point(20, 72)
    $userLabel.Size = New-Object Drawing.Size(100, 22)

    $userBox = New-Object Windows.Forms.TextBox
    $userBox.Location = New-Object Drawing.Point(125, 69)
    $userBox.Size = New-Object Drawing.Size(335, 24)
    $userBox.Text = $DefaultUserName
    $userBox.ReadOnly = -not $UserNameRequired

    $passwordLabel = New-Object Windows.Forms.Label
    $passwordLabel.Text = if ($UserNameRequired) { 'SecretKey' } else { 'API Key' }
    $passwordLabel.Location = New-Object Drawing.Point(20, 112)
    $passwordLabel.Size = New-Object Drawing.Size(100, 22)

    $passwordBox = New-Object Windows.Forms.TextBox
    $passwordBox.Location = New-Object Drawing.Point(125, 109)
    $passwordBox.Size = New-Object Drawing.Size(335, 24)
    $passwordBox.UseSystemPasswordChar = $true

    $okButton = New-Object Windows.Forms.Button
    $okButton.Text = 'Save securely'
    $okButton.Location = New-Object Drawing.Point(260, 165)
    $okButton.Size = New-Object Drawing.Size(110, 32)
    $okButton.DialogResult = [Windows.Forms.DialogResult]::OK

    $cancelButton = New-Object Windows.Forms.Button
    $cancelButton.Text = 'Cancel'
    $cancelButton.Location = New-Object Drawing.Point(380, 165)
    $cancelButton.Size = New-Object Drawing.Size(80, 32)
    $cancelButton.DialogResult = [Windows.Forms.DialogResult]::Cancel

    $form.Controls.AddRange(@($messageLabel, $userLabel, $userBox, $passwordLabel, $passwordBox, $okButton, $cancelButton))
    $form.AcceptButton = $okButton
    $form.CancelButton = $cancelButton
    $form.Add_Shown({ $passwordBox.Select() })
    try {
        if ($form.ShowDialog() -ne [Windows.Forms.DialogResult]::OK) {
            Fail 'INTEGRATION_USER_CANCELLED'
        }
        $userName = $userBox.Text.Trim()
        $plainText = $passwordBox.Text
        if ([string]::IsNullOrEmpty($userName) -or [string]::IsNullOrEmpty($plainText)) {
            Fail 'INTEGRATION_CREDENTIAL_INVALID'
        }
        $secureValue = New-Object Security.SecureString
        foreach ($character in $plainText.ToCharArray()) { $secureValue.AppendChar($character) }
        $secureValue.MakeReadOnly()
        $passwordBox.Clear()
        $plainText = $null
        return [Management.Automation.PSCredential]::new($userName, $secureValue)
    } finally {
        $passwordBox.Clear()
        $form.Dispose()
    }
}

function Decode-Input {
    $text = $InputBase64Url.Replace('-', '+').Replace('_', '/')
    switch ($text.Length % 4) {
        2 { $text += '==' }
        3 { $text += '=' }
        1 { Fail 'INTEGRATION_INPUT_INVALID' }
    }
    try {
        $json = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($text))
        $value = $json | ConvertFrom-Json
    } catch {
        Fail 'INTEGRATION_INPUT_INVALID'
    }
    if ($null -eq $value) { Fail 'INTEGRATION_INPUT_INVALID' }
    return $value
}

function Set-PrivateAcl([string]$Path) {
    $currentSid = [Security.Principal.WindowsIdentity]::GetCurrent().User
    $systemSid = New-Object Security.Principal.SecurityIdentifier 'S-1-5-18'
    $acl = New-Object Security.AccessControl.FileSecurity
    $acl.SetOwner($currentSid)
    $acl.SetAccessRuleProtection($true, $false)
    foreach ($sid in @($currentSid, $systemSid)) {
        $rule = New-Object Security.AccessControl.FileSystemAccessRule(
            $sid,
            [Security.AccessControl.FileSystemRights]::FullControl,
            [Security.AccessControl.AccessControlType]::Allow
        )
        [void]$acl.AddAccessRule($rule)
    }
    [IO.File]::SetAccessControl($Path, $acl)
}

function Write-PrivateUtf8([string]$Path, [string]$Content) {
    $parent = Split-Path -Parent $Path
    [IO.Directory]::CreateDirectory($parent) | Out-Null
    $temporary = "$Path.tmp"
    if (Test-Path -LiteralPath $temporary) { Fail 'INTEGRATION_STALE_TEMPORARY_FILE' }
    try {
        [IO.File]::WriteAllText($temporary, $Content, (New-Object Text.UTF8Encoding($false)))
        Set-PrivateAcl $temporary
        Move-Item -LiteralPath $temporary -Destination $Path -Force
        Set-PrivateAcl $Path
    } finally {
        if (Test-Path -LiteralPath $temporary) { Remove-Item -LiteralPath $temporary -Force }
    }
}

function Protect-SecureString([Security.SecureString]$SecureValue) {
    $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($SecureValue)
    $bytes = $null
    try {
        $byteCount = [Runtime.InteropServices.Marshal]::ReadInt32($pointer, -4)
        if ($byteCount -lt 2 -or $byteCount -gt 8192 -or ($byteCount % 2) -ne 0) { Fail 'INTEGRATION_CREDENTIAL_INVALID' }
        $bytes = New-Object byte[] $byteCount
        [Runtime.InteropServices.Marshal]::Copy($pointer, $bytes, 0, $bytes.Length)
        $protected = [Security.Cryptography.ProtectedData]::Protect(
            $bytes,
            [Text.Encoding]::UTF8.GetBytes('paw.shiguang.integration-config.v1'),
            [Security.Cryptography.DataProtectionScope]::CurrentUser
        )
        return [Convert]::ToBase64String($protected)
    } finally {
        if ($null -ne $bytes) { [Array]::Clear($bytes, 0, $bytes.Length) }
        if ($pointer -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer) }
    }
}

function Unprotect-Text([string]$ProtectedBase64) {
    $protected = [Convert]::FromBase64String($ProtectedBase64)
    $bytes = [Security.Cryptography.ProtectedData]::Unprotect(
        $protected,
        [Text.Encoding]::UTF8.GetBytes('paw.shiguang.integration-config.v1'),
        [Security.Cryptography.DataProtectionScope]::CurrentUser
    )
    try { return [Text.Encoding]::Unicode.GetString($bytes) }
    finally {
        [Array]::Clear($protected, 0, $protected.Length)
        [Array]::Clear($bytes, 0, $bytes.Length)
    }
}

function Read-AiMetadata {
    if (-not (Test-Path -LiteralPath $AiConfigPath -PathType Leaf)) {
        return @{ configured = $false; endpoint_host = $null; model = $null }
    }
    try {
        $config = Get-Content -LiteralPath $AiConfigPath -Raw -Encoding UTF8 | ConvertFrom-Json
        $uri = [Uri]$config.endpoint
        $valid = (
            $config.schema_version -ceq 'paw.shiguang.ai-provider-config.v1' -and
            $uri.Scheme -ceq 'https' -and $uri.AbsolutePath -ceq '/v1/chat/completions' -and
            [string]::IsNullOrEmpty($uri.Query) -and [string]::IsNullOrEmpty($uri.Fragment) -and
            [string]::IsNullOrEmpty($uri.UserInfo) -and $uri.IsDefaultPort -and
            $uri.DnsSafeHost -cmatch '^[A-Za-z0-9](?:[A-Za-z0-9.-]{0,251}[A-Za-z0-9])?$' -and
            $config.model -cmatch '^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$' -and
            $config.protected_api_key_base64 -is [string]
        )
        if (-not $valid) { throw 'invalid' }
        return @{ configured = $true; endpoint_host = $uri.DnsSafeHost; model = [string]$config.model }
    } catch {
        return @{ configured = $false; endpoint_host = $null; model = $null }
    }
}

function Read-CosMetadata {
    if (-not (Test-Path -LiteralPath $CosConfigPath -PathType Leaf)) {
        return @{ configured = $false; bucket = $null; region = $null }
    }
    try {
        $content = Get-Content -LiteralPath $CosConfigPath -Raw -Encoding UTF8
        $values = @{}
        foreach ($name in @('QCLOUD_SECRET_ID', 'QCLOUD_SECRET_KEY', 'COS_DATALAKE_BUCKET', 'COS_DATALAKE_REGION', 'COS_DATALAKE_HOST')) {
            $pattern = '(?m)^\s*(?:export\s+)?{0}\s*=\s*"([^"\r\n]+)"\s*$' -f [regex]::Escape($name)
            $match = [regex]::Match($content, $pattern)
            if (-not $match.Success) { throw 'invalid' }
            $values[$name] = $match.Groups[1].Value
        }
        $bucket = $values.COS_DATALAKE_BUCKET
        $region = $values.COS_DATALAKE_REGION
        if ($bucket -cnotmatch '^[a-z0-9][a-z0-9-]{0,49}-[0-9]{5,20}$' -or $region -cnotmatch '^[a-z]{2,12}-[a-z0-9-]{2,40}$') { throw 'invalid' }
        if ($values.COS_DATALAKE_HOST -cne "$bucket.cos.$region.myqcloud.com") { throw 'invalid' }
        if ($values.QCLOUD_SECRET_ID.Length -lt 8 -or $values.QCLOUD_SECRET_KEY.Length -lt 8) { throw 'invalid' }
        return @{ configured = $true; bucket = $bucket; region = $region }
    } catch {
        return @{ configured = $false; bucket = $null; region = $null }
    }
}

function Read-RuntimeMetadata {
    $task = Get-ScheduledTask -TaskPath $TaskPath -TaskName $TaskName -ErrorAction SilentlyContinue
    $taskState = if ($null -eq $task) { 'NotInstalled' } else { [string]$task.State }
    return @{
        task_installed = $null -ne $task
        task_state = $taskState
    }
}

try {
    $stage = 'input'
    $inputValue = Decode-Input
    if ($Action -ceq 'status') {
        Write-Result @{
            ok = $true
            code = 'INTEGRATION_STATUS_READY'
            runtime = (Read-RuntimeMetadata)
            ai = (Read-AiMetadata)
            cos = (Read-CosMetadata)
        }
    }

    if ($Action -ceq 'configure-ai') {
        if ($inputValue.PSObject.Properties.Name.Count -ne 2 -or $null -eq $inputValue.endpoint -or $null -eq $inputValue.model) { Fail 'AI_CONFIGURATION_INVALID' }
        $endpoint = [Uri][string]$inputValue.endpoint
        $model = [string]$inputValue.model
        if ($endpoint.Scheme -cne 'https' -or $endpoint.AbsolutePath -cne '/v1/chat/completions' -or -not [string]::IsNullOrEmpty($endpoint.Query) -or -not [string]::IsNullOrEmpty($endpoint.Fragment) -or -not [string]::IsNullOrEmpty($endpoint.UserInfo) -or -not $endpoint.IsDefaultPort -or $endpoint.DnsSafeHost -cnotmatch '^[A-Za-z0-9](?:[A-Za-z0-9.-]{0,251}[A-Za-z0-9])?$' -or $model -cnotmatch '^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$') { Fail 'AI_CONFIGURATION_INVALID' }
        $stage = 'credential-prompt'
        $credential = Request-SecretCredential -Title 'Shiguang AI secure setup' -Message 'Enter the model API key. It will be protected with Windows DPAPI CurrentUser.' -UserNameRequired $false -DefaultUserName 'api-key'
        $stage = 'config-write'
        $document = [ordered]@{
            schema_version = 'paw.shiguang.ai-provider-config.v1'
            endpoint = $endpoint.AbsoluteUri
            endpoint_host = $endpoint.DnsSafeHost
            model = $model
            protected_api_key_base64 = (Protect-SecureString $credential.Password)
            dpapi_scope = 'CurrentUser'
        }
        Write-PrivateUtf8 $AiConfigPath (($document | ConvertTo-Json -Depth 4) + "`n")
        Write-Result @{ ok = $true; code = 'AI_CONFIGURATION_SAVED'; kind = 'ai'; ai = (Read-AiMetadata) }
    }

    if ($Action -ceq 'configure-cos') {
        if ($inputValue.PSObject.Properties.Name.Count -ne 2 -or $null -eq $inputValue.bucket -or $null -eq $inputValue.region) { Fail 'COS_CONFIGURATION_INVALID' }
        $bucket = [string]$inputValue.bucket
        $region = [string]$inputValue.region
        if ($bucket -cnotmatch '^[a-z0-9][a-z0-9-]{0,49}-[0-9]{5,20}$' -or $region -cnotmatch '^[a-z]{2,12}-[a-z0-9-]{2,40}$') { Fail 'COS_CONFIGURATION_INVALID' }
        $stage = 'credential-prompt'
        $credential = Request-SecretCredential -Title 'Shiguang COS secure setup' -Message 'Enter SecretId and SecretKey. Saving replaces the current user COS binding.' -UserNameRequired $true -DefaultUserName ''
        $stage = 'config-write'
        $secretId = $credential.UserName
        $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($credential.Password)
        $secretKey = $null
        try { $secretKey = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer) }
        finally { if ($pointer -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer) } }
        if ($secretId -cnotmatch '^[-A-Za-z0-9._/+=]{8,512}$' -or $secretKey -cnotmatch '^[-A-Za-z0-9._/+=]{8,512}$') { Fail 'COS_CREDENTIAL_INVALID' }
        $hostName = "${bucket}.cos.${region}.myqcloud.com"
        $content = @(
            "QCLOUD_SECRET_ID=`"$secretId`""
            "QCLOUD_SECRET_KEY=`"$secretKey`""
            "COS_DATALAKE_BUCKET=`"$bucket`""
            "COS_DATALAKE_REGION=`"$region`""
            "COS_DATALAKE_HOST=`"$hostName`""
        ) -join "`r`n"
        Write-PrivateUtf8 $CosConfigPath ($content + "`r`n")
        $secretKey = $null
        $content = $null
        Write-Result @{ ok = $true; code = 'COS_CONFIGURATION_SAVED'; kind = 'cos'; cos = (Read-CosMetadata) }
    }

    if ($Action -ceq 'test-ai') {
        $metadata = Read-AiMetadata
        if (-not $metadata.configured) { Fail 'AI_NOT_CONFIGURED' }
        $config = Get-Content -LiteralPath $AiConfigPath -Raw -Encoding UTF8 | ConvertFrom-Json
        $apiKey = Unprotect-Text ([string]$config.protected_api_key_base64)
        try {
            $body = @{ model = [string]$config.model; max_tokens = 1; temperature = 0; messages = @(@{ role = 'user'; content = 'Return OK.' }) } | ConvertTo-Json -Compress -Depth 5
            $response = Invoke-WebRequest -UseBasicParsing -Method Post -Uri ([string]$config.endpoint) -Headers @{ Authorization = "Bearer $apiKey" } -ContentType 'application/json' -Body $body -TimeoutSec 30
            if ($response.StatusCode -lt 200 -or $response.StatusCode -ge 300) { Fail 'AI_CONNECTION_TEST_FAILED' }
        } catch { Fail 'AI_CONNECTION_TEST_FAILED' }
        finally { $apiKey = $null }
        Write-Result @{ ok = $true; code = 'AI_CONNECTION_TEST_PASSED'; kind = 'ai' }
    }

    if ($Action -ceq 'start-runtime') {
        $task = Get-ScheduledTask -TaskPath $TaskPath -TaskName $TaskName -ErrorAction SilentlyContinue
        if ($null -eq $task) { Fail 'NODEGATEWAY_TASK_NOT_INSTALLED' }
        Start-ScheduledTask -TaskPath $TaskPath -TaskName $TaskName
        Start-Sleep -Milliseconds 800
        Write-Result @{ ok = $true; code = 'NODEGATEWAY_START_REQUESTED'; kind = 'runtime'; runtime = (Read-RuntimeMetadata) }
    }

    Fail 'INTEGRATION_ACTION_INVALID'
} catch {
    if ($stage -ceq 'credential-prompt') { Fail 'INTEGRATION_CREDENTIAL_PROMPT_FAILED' }
    if ($stage -ceq 'config-write') { Fail 'INTEGRATION_CONFIG_WRITE_FAILED' }
    Fail 'INTEGRATION_CONFIGURATOR_FAILED'
}
