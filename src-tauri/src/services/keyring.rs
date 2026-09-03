use keyring::Entry;
use base64::{engine::general_purpose::STANDARD, Engine};

const SERVICE_NAME: &str = "com.local.model-test";

pub fn store_api_key(config_id: &str, api_key: &str) -> Result<(), String> {
    let entry = Entry::new(SERVICE_NAME, config_id)
        .map_err(|e| format!("Failed to create keyring entry: {}", e))?;

    entry.set_password(api_key)
        .map_err(|e| format!("Failed to store API key: {}", e))?;

    Ok(())
}

pub fn retrieve_api_key(config_id: &str) -> Result<String, String> {
    let entry = Entry::new(SERVICE_NAME, config_id)
        .map_err(|e| format!("Failed to create keyring entry: {}", e))?;

    entry.get_password()
        .map_err(|e| format!("Failed to retrieve API key: {}", e))
}

pub fn delete_api_key(config_id: &str) -> Result<(), String> {
    let entry = Entry::new(SERVICE_NAME, config_id)
        .map_err(|e| format!("Failed to create keyring entry: {}", e))?;

    entry.delete_credential()
        .map_err(|e| format!("Failed to delete API key: {}", e))
}

// Mask API key for display (show first 8 and last 4 characters)
pub fn mask_api_key(api_key: &str) -> String {
    if api_key.len() <= 12 {
        return "*".repeat(api_key.len());
    }

    let start = &api_key[..8];
    let end = &api_key[api_key.len() - 4..];
    format!("{}...{}", start, end)
}

// Encode API key to base64 for fallback storage
pub fn encode_api_key(api_key: &str) -> String {
    STANDARD.encode(api_key.as_bytes())
}

// Decode base64 API key from fallback storage
pub fn decode_api_key(encoded: &str) -> Result<String, String> {
    let bytes = STANDARD.decode(encoded)
        .map_err(|e| format!("Failed to decode API key: {}", e))?;

    String::from_utf8(bytes)
        .map_err(|e| format!("Failed to convert API key: {}", e))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_mask_api_key() {
        assert_eq!(mask_api_key("sk-1234567890abcdef"), "sk-12345...cdef");
        assert_eq!(mask_api_key("short"), "*****");
    }

    #[test]
    fn test_encode_decode() {
        let key = "sk-test-key-123";
        let encoded = encode_api_key(key);
        let decoded = decode_api_key(&encoded).unwrap();
        assert_eq!(key, decoded);
    }
}
