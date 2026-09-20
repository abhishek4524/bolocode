use keyring::Entry;

const SERVICE_NAME: &str = "BoloCodeAgent";

pub fn set_api_key(service: &str, key: &str) -> Result<(), String> {
    let target_key = format!("api_key_{}", service.to_lowercase());
    let entry = Entry::new(SERVICE_NAME, &target_key).map_err(|e| e.to_string())?;
    if key.trim().is_empty() {
        match entry.delete_password() {
            Ok(_) | Err(keyring::Error::NoEntry) => Ok(()),
            Err(e) => Err(e.to_string()),
        }
    } else {
        entry.set_password(key).map_err(|e| e.to_string())
    }
}

pub fn get_api_key(service: &str) -> Result<Option<String>, String> {
    let target_key = format!("api_key_{}", service.to_lowercase());
    let entry = Entry::new(SERVICE_NAME, &target_key).map_err(|e| e.to_string())?;
    match entry.get_password() {
        Ok(pw) => Ok(Some(pw)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}
